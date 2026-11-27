import argparse
import array
import base64
import functools
import hashlib
import json
import os
import re
import subprocess
import tempfile
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Event, Thread
from xml.etree import ElementTree

import imageio_ffmpeg
from oracle import boot_iphone, check_tones, serve_https

HERE = Path(__file__).resolve().parent
OUTPUT = Path("device-output")
URL = "http://127.0.0.1:8765/ios-safari-probe.html"


def command(*args):
    return subprocess.check_output(args, text=True, timeout=90).strip()


def android_open(loaded):
    def adb(*args):
        return command("adb", *args)
    package = "com.android.chrome"
    package_info = adb("shell", "dumpsys", "package", package)
    version = re.search(r"versionName=(\S+)", package_info).group(1)
    device = {"device": adb("shell", "getprop", "ro.product.model"),
              "runtime": adb("shell", "getprop", "ro.build.fingerprint"), "appVersion": version}
    print("Android Chrome", device)
    adb("reverse", "tcp:8765", "tcp:8765")
    adb("shell", "am", "set-debug-app", "--persistent", package)
    adb("shell", "echo 'chrome --disable-fre --no-first-run --disable-search-engine-choice-screen' > /data/local/tmp/chrome-command-line")
    adb("shell", "am", "force-stop", package)
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", URL, package)
    for _ in range(16):
        if loaded.wait(2):
            break
        adb("shell", "uiautomator", "dump", "/sdcard/probe-window.xml")
        tree = ElementTree.fromstring(adb("shell", "cat", "/sdcard/probe-window.xml"))
        for element in tree.iter("node"):
            label = element.get("text", "") + " " + element.get("content-desc", "")
            if re.search(r"use without an account|continue without an account|accept & continue|no thanks|got it|use chrome without an account|skip", label, re.I):
                x, y, end_x, end_y = map(int, re.findall(r"\d+", element.get("bounds")))
                adb("shell", "input", "tap", str((x + end_x) // 2), str((y + end_y) // 2))
                break
    if not loaded.is_set():
        (OUTPUT / "android-window.xml").write_text(adb("shell", "cat", "/sdcard/probe-window.xml"))
        raise RuntimeError("The Android Chrome app did not reach the loopback page")
    width, height = map(int, re.findall(r"(\d+)x(\d+)", adb("shell", "wm", "size"))[-1])
    adb("shell", "input", "tap", str(width // 2), str(height // 2))
    return device


def capture(platform, certificates):
    done, loaded = Event(), Event()
    report, stages, identity = {}, [], {}
    assets = {"ios-safari-probe.html", "ios-safari-worker.js", "casai-audio.js", "cases.js"}

    class Page(SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/status":
                body = ("captured" if done.is_set() else "loaded" if loaded.is_set() else "waiting").encode()
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif self.path.lstrip("/") in assets or re.fullmatch(r"/media/[\w.-]+", self.path):
                super().do_GET()
            else:
                self.send_error(404)

        def do_POST(self):
            data = self.rfile.read(int(self.headers["Content-Length"]))
            if self.path == "/stage":
                stage = data.decode()
                stages.append(stage)
                print("Page", stage)
                if stage == "loaded":
                    loaded.set()
            elif self.path == "/capture":
                report.update(json.loads(data))
                done.set()
            elif re.fullmatch(r"/files/[\w.-]+", self.path):
                (OUTPUT / self.path.split("/")[-1]).write_bytes(data)
            else:
                self.send_error(404)
                return
            self.send_response(204)
            self.end_headers()

        def log_message(self, fmt, *args):
            if self.path != "/status" and self.path != "/stage":
                super().log_message(fmt, *args)

    server = ThreadingHTTPServer(("127.0.0.1", 8765), functools.partial(Page, directory=str(HERE)))
    if platform == "ios":
        phone, runtime = boot_iphone()
        identity = {"device": phone["name"], "runtime": runtime, "xcode": command("xcodebuild", "-version")}
        serve_https(server, phone, certificates)
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        if platform == "ios":
            subprocess.run(["xcrun", "simctl", "openurl", phone["udid"], URL.replace("http:", "https:")], check=True)
            subprocess.run(["xcodebuild", "test", "-project", str(HERE / "ios-safari-ui/SafariRecording.xcodeproj"),
                            "-scheme", "SafariRecording", "-destination", "id=" + phone["udid"], "-quiet",
                            "-parallel-testing-enabled", "NO", "-maximum-test-execution-time-allowance", "960"], check=True)
        elif platform == "android":
            identity = android_open(loaded)
            if not done.wait(850):
                raise TimeoutError("Android Chrome did not complete the checks")
        else:
            from selenium import webdriver
            from selenium.webdriver.common.by import By
            if platform == "macos":
                from selenium.webdriver.safari.service import Service
                browser = webdriver.Safari(service=Service("/usr/bin/safaridriver"))
                identity = {"device": command("uname", "-m"), "runtime": command("sw_vers")}
            else:
                options = webdriver.ChromeOptions()
                options.add_argument("--headless=new")
                options.add_argument("--autoplay-policy=no-user-gesture-required")
                browser = webdriver.Chrome(options=options)
            with browser:
                identity["appVersion"] = browser.capabilities["browserVersion"]
                browser.get(URL)
                browser.find_element(By.ID, "record").click()
                if not done.wait(850):
                    raise TimeoutError("Browser did not complete the checks")
        if not report:
            raise RuntimeError(f"Missing browser report after {stages}")
        return {**report, **identity, "stages": stages, "runnerImage": os.getenv("ImageVersion")}
    finally:
        (OUTPUT / "stages.json").write_text(json.dumps(stages, indent=2))
        server.shutdown()
        server.server_close()


def ffmpeg(*args):
    return subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", *map(str, args)],
                          capture_output=True, check=True).stdout


def pcm(path, mix):
    samples = array.array("h")
    samples.frombytes(ffmpeg("-i", path, "-map", "0:a:0", "-af", mix, "-f", "s16le", "pipe:1"))
    return samples


def validate(report, platform):
    ua = report["userAgent"]
    assert report["secureContext"], "Recording must run in a secure browser context"
    if platform == "ios":
        assert "iPhone" in ua and "Version/" in ua and "Safari/" in ua, ua
    elif platform == "macos":
        assert "Macintosh" in ua and "Version/" in ua and "Safari/" in ua, ua
    elif platform == "android":
        assert "Android" in ua and "Chrome/" in ua, ua
    movie = "mp4" in report["mime"]
    path = OUTPUT / ("fresh.mp4" if movie else "fresh.webm")
    original = path.read_bytes()
    assert (original[4:8] == b"ftyp") if movie else original.startswith(bytes.fromhex("1a45dfa3"))
    worker = report["worker"]
    assert worker["bytes"] == sum(report["chunkSizes"]) == len(original) and worker["chunks"] > 1
    assert worker["sha256"] == hashlib.sha256(original).hexdigest()
    tones = check_tones(path)
    report["independentDecode"] = tones
    mix = "pan=mono|c0=0.5*c0+0.5*c1" if "stereo" in tones["stream"] else "anull"
    reference = pcm(path, mix)
    if movie:
        packets = ffmpeg("-copyts", "-i", path, "-map", "0:a:0", "-c:a", "copy", "-f", "framecrc", "pipe:1").decode()
        rate = int(re.search(r"#tb 0: 1/(\d+)", packets).group(1))
        assert rate == report["sourceRate"], (rate, report["sourceRate"])
        last = next(row for row in reversed(packets.splitlines()) if row.startswith("0,")).split(",")
        reference = reference[:int(last[2]) + int(last[3])]
    if report.get("freshError"):
        raise AssertionError(report["freshError"])
    provider = OUTPUT / "blob.wav"
    assert provider.read_bytes() == (OUTPUT / "split.wav").read_bytes(), "Provider Blob and stream WAVs differ"
    actual = pcm(provider, "anull")
    report.update(providerFrames=len(actual), referenceFrames=len(reference),
                  providerSha256=hashlib.sha256(provider.read_bytes()).hexdigest())
    assert len(actual) == len(reference), (len(actual), len(reference))
    peak = max(abs(a - b) for a, b in zip(actual, reference))
    report["peakPcm16Error"] = peak
    assert peak <= 16, f"Maximum provider PCM16 error {peak}"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("platform", choices=["android", "ios", "macos", "local"])
    platform = parser.parse_args().platform
    OUTPUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        report = capture(platform, Path(temp))
    try:
        if "error" in report:
            raise AssertionError(report["error"])
        validate(report, platform)
    finally:
        result = json.dumps(report, indent=2) + "\n"
        (OUTPUT / "report.json").write_text(result)
        print(result)
