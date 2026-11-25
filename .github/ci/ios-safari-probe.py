import array
import base64
import functools
import hashlib
import json
import math
import os
import re
import subprocess
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


def capture(phone):
    report = {}

    class ProbePage(SimpleHTTPRequestHandler):
        def do_POST(self):
            if self.path != "/capture":
                self.send_error(404)
                return
            report.update(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
            self.send_response(204)
            self.end_headers()

    directory = Path(__file__).resolve().parent
    handler = functools.partial(ProbePage, directory=str(directory))
    server = ThreadingHTTPServer(("127.0.0.1", 8765), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        result = subprocess.run(["xcodebuild", "test", "-project", str(directory / "ios-safari-ui/SafariRecording.xcodeproj"),
                                 "-scheme", "SafariRecording", "-destination", "id=" + phone["udid"],
                                 "-parallel-testing-enabled", "NO", "-maximum-test-execution-time-allowance", "120"])
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
report = capture(phone)
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
