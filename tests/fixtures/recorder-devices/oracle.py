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


def check_tones(path):
    rate, size = 16000, 800
    decoded = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-nostats",
                              "-i", str(path), "-map", "0:a:0", "-ac", "1", "-ar", str(rate),
                              "-f", "s16le", "pipe:1"], capture_output=True, check=True)
    audio_description = next(line.strip() for line in decoded.stderr.decode().splitlines() if "Audio:" in line)
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


