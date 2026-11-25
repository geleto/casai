import array
import base64
import functools
import hashlib
import json
import math
import os
import re
import ssl
import subprocess
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

import imageio_ffmpeg


def boot_iphone():
    devices = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "--json"]))
    runtime = "com.apple.CoreSimulator.SimRuntime.iOS-27-2"
    phones = [item for item in devices["devices"].get(runtime, []) if item["name"].startswith("iPhone")]
    if not phones:
        raise RuntimeError(f"No iPhone available on {runtime}: {list(devices['devices'])}")
    phone = next((item for item in phones if item["name"] == "iPhone 17"), phones[0])
    print("Booting", runtime, phone["name"], phone["udid"])
    subprocess.run(["xcrun", "simctl", "bootstatus", phone["udid"], "-b"], check=True, timeout=360,
                   stdout=subprocess.DEVNULL)
    return phone, runtime


def serve_https(server, phone, directory):
    def openssl(*args):
        subprocess.run(["openssl", *args], cwd=directory, check=True, capture_output=True)
    (directory / "root.conf").write_text("[req]\ndistinguished_name=dn\n[dn]\n[root]\n"
                                         "basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n")
    openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "2",
            "-subj", "/CN=Safari Probe CA", "-config", "root.conf", "-extensions", "root",
            "-keyout", "root.key", "-out", "root.pem")
    openssl("req", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=localhost",
            "-keyout", "server.key", "-out", "server.csr")
    (directory / "extensions").write_text("basicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\n"
                                         "extendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1,DNS:localhost\n")
    openssl("x509", "-req", "-in", "server.csr", "-CA", "root.pem", "-CAkey", "root.key",
            "-CAcreateserial", "-sha256", "-days", "2", "-extfile", "extensions", "-out", "server.pem")
    subprocess.run(["xcrun", "simctl", "keychain", phone["udid"], "add-root-cert", str(directory / "root.pem")], check=True)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(directory / "server.pem", directory / "server.key")
    server.socket = context.wrap_socket(server.socket, server_side=True, do_handshake_on_connect=False)


def capture(phone, certificates):
    report = {}
    progress = []

    class ProbePage(SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/status":
                value = ("captured" if report else "loaded" if "loaded" in progress else "waiting").encode()
                self.send_response(200)
                self.send_header("Content-Length", str(len(value)))
                self.end_headers()
                self.wfile.write(value)
                return
            super().do_GET()

        def do_POST(self):
            data = self.rfile.read(int(self.headers["Content-Length"]))
            if self.path == "/stage":
                progress.append(data.decode())
                print("Safari page", progress[-1], self.headers.get("User-Agent"))
            elif self.path == "/capture":
                report.update(json.loads(data))
            else:
                self.send_error(404)
                return
            self.send_response(204)
            self.end_headers()

    directory = Path(__file__).resolve().parent
    handler = functools.partial(ProbePage, directory=str(directory))
    server = ThreadingHTTPServer(("127.0.0.1", 8765), handler)
    serve_https(server, phone, certificates)
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        subprocess.run(["xcrun", "simctl", "openurl", phone["udid"],
                        "https://127.0.0.1:8765/ios-safari-probe.html"], check=True)
        result = subprocess.run(["xcodebuild", "test", "-project", str(directory / "ios-safari-ui/SafariRecording.xcodeproj"),
                                 "-scheme", "SafariRecording", "-destination", "id=" + phone["udid"],
                                 "-quiet", "-parallel-testing-enabled", "NO", "-maximum-test-execution-time-allowance", "220"])
        print("Browser progress", progress)
        if "error" in report:
            raise RuntimeError(report["error"])
        result.check_returncode()
        if not report:
            raise RuntimeError("Safari did not submit a recording")
        report["safariVersion"] = re.search(r"Version/([\d.]+)", report["userAgent"]).group(1)
        return report
    finally:
        server.shutdown()
        server.server_close()


def check_tones(path):
    rate, size = 16000, 800
    decoded = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-nostats",
                              "-i", str(path), "-map", "0:a:0", "-ac", "1", "-ar", str(rate),
                              "-f", "s16le", "pipe:1"], capture_output=True, check=True)
    audio_description = next(line.strip() for line in decoded.stderr.decode().splitlines() if "Audio: aac" in line)
    samples = array.array("h")
    samples.frombytes(decoded.stdout)
    counts = {523: 0, 997: 0}
    for start in range(0, len(samples) - size + 1, size):
        window = samples[start:start + size]
        levels = {}
        for hz in counts:
            step = 2 * math.pi * hz / rate
            sine = sum(sample * math.sin(step * i) for i, sample in enumerate(window))
            cosine = sum(sample * math.cos(step * i) for i, sample in enumerate(window))
            levels[hz] = 2 * math.hypot(sine, cosine) / size
        if levels[523] > max(500, 4 * levels[997]) and counts[997] == 0:
            counts[523] += 1
        if levels[997] > max(500, 4 * levels[523]) and counts[523] >= 3:
            counts[997] += 1
    assert min(counts.values()) >= 3, f"Missing ordered tones in recorded audio: {counts}"
    return {"stream": audio_description, "comparisonRate": rate, "decodedFrames": len(samples),
            "orderedToneWindows": counts, "windowMilliseconds": 50}


phone, runtime = boot_iphone()
with tempfile.TemporaryDirectory() as temporary:
    report = capture(phone, Path(temporary))
recording = base64.b64decode(report.pop("audio"), validate=True)
worker = report["worker"]
assert "iPhone" in report["userAgent"] and "mp4" in report["mime"]
assert recording[4:8] == b"ftyp" and sum(report["chunkSizes"]) == len(recording)
assert worker["chunks"] >= 2 and worker["bytes"] == len(recording)
assert worker["sha256"] == hashlib.sha256(recording).hexdigest()
output = Path("ios-safari-output")
output.mkdir(exist_ok=True)
path = output / "simulator-safari.mp4"
path.write_bytes(recording)
report.update(device=phone["name"], runtime=runtime, runnerImage=os.getenv("ImageVersion"),
              xcode=subprocess.check_output(["xcodebuild", "-version"], text=True).strip(),
              independentDecode=check_tones(path))
summary = json.dumps(report, indent=2) + "\n"
(output / "capture.json").write_text(summary)
print(summary)
