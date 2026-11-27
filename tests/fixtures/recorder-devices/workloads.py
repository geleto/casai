import hashlib
import shutil
import struct
import subprocess
from pathlib import Path

import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
MEDIA = HERE / "media"
FF = imageio_ffmpeg.get_ffmpeg_exe()
CORPUS = {
    "review-ios-safari-aac.mp4": 97216, "review-safari-aac.mp4": 78784,
    "review-chrome-aac.mp4": 63469, "review-chrome-aac-recorder-pause.mp4": 63855,
    "review-firefox-opus.ogg": 64384, "shorter.ogg": 64144,
    "review-android-chrome-open-cluster.webm": 452160,
}
PROFILES = {"wav": "stereo.wav", "webm": "long.webm", "aac": "long.m4a"}


def ff(*args):
    return subprocess.check_output([FF, "-v", "error", "-y", *map(str, args)])


def large_recorder_clusters():
    # Retain the Android recorder's track header and complete packets. Each packet is 60 ms.
    original = (MEDIA / "review-android-chrome-open-cluster.webm").read_bytes()
    cluster = original.index(bytes.fromhex("1f43b675"))
    first = original.index(bytes.fromhex("e78100"), cluster) + 3
    pos, packets = first, []
    while pos < len(original):
        assert original[pos] == 0xa3
        width = 9 - original[pos + 1].bit_length()
        size = int.from_bytes(original[pos + 1:pos + 1 + width], "big") ^ (1 << (7 * width))
        block = original[pos:pos + 1 + width + size]
        assert len(block) == 1 + width + size and block[1 + width] == 0x81
        packets.append((block, 2 + width))
        pos += len(block)
    data = bytearray(original[:first])
    for index in range(540):
        block, stamp = packets[index % len(packets)]
        start = len(data)
        data.extend(block)
        struct.pack_into(">h", data, start + stamp, 60 * index)
    (MEDIA / "large-open.webm").write_bytes(data)
    size = cluster + 4
    width = 9 - data[size].bit_length()
    length = len(data) - size - width
    if width * 7 < length.bit_length():
        data[size:size + width] = ((1 << 21) | length).to_bytes(3, "big")
    else:
        data[size:size + width] = ((1 << (7 * width)) | length).to_bytes(width, "big")
    (MEDIA / "large-sized.webm").write_bytes(data)


def prepare():
    MEDIA.mkdir(exist_ok=True)
    for name in CORPUS:
        if name != "shorter.ogg":
            shutil.copyfile(HERE.parent / name, MEDIA / name)
    data = bytearray((MEDIA / "review-firefox-opus.ogg").read_bytes())
    last = data.rindex(b"OggS")
    struct.pack_into("<Q", data, last + 6, 64456)
    struct.pack_into("<I", data, last + 22, 0xfe20860c)
    (MEDIA / "shorter.ogg").write_bytes(data)
    large_recorder_clusters()
    if not (MEDIA / "stereo.wav").exists():
        ff("-f", "lavfi", "-i", "aevalsrc=0.4*sin(2*PI*261*t)|0.25*sin(2*PI*773*t):s=48000:d=72",
           "-c:a", "pcm_s16le", MEDIA / "stereo.wav")
    if not (MEDIA / "long.m4a").exists():
        ff("-f", "lavfi", "-i", "sine=frequency=673:sample_rate=48000:duration=256",
           "-c:a", "aac", "-b:a", "160k", "-f", "adts", MEDIA / "packets.aac")
        ff("-i", MEDIA / "packets.aac", "-c:a", "copy", "-use_editlist", "0", "-movie_timescale", "48000",
           "-movflags", "+faststart", MEDIA / "long.m4a")
    if not (MEDIA / "long.webm").exists():
        name = "review-chrome-opus.webm"
        shutil.copyfile(HERE.parent / name, MEDIA / name)
        listing = MEDIA / "packets.ffconcat"
        listing.write_text("ffconcat version 1.0\n" + (f"file {name}\nduration 0.960\n" * 270))
        ff("-f", "concat", "-safe", "0", "-i", listing, "-c:a", "copy", MEDIA / "long.webm")


def decoded_hash(path):
    return ff("-i", path, "-map", "0:a:0", "-c:a", "pcm_s16le", "-f", "hash", "-hash", "sha256", "-").decode().strip()


def packet_manifest(path):
    text = ff("-i", path, "-map", "0:a:0", "-c:a", "copy", "-f", "framehash", "-hash", "sha256", "-").decode()
    return [row.split(",")[4].strip() + ":" + row.split(",")[5].strip() for row in text.splitlines() if row.startswith("0,")]


def validate_cases(report, output, failures):
    indexed = {case["name"]: case for case in report.get("cases", [])}
    def check(name, verify):
        try:
            case = indexed[name]
            assert "error" not in case, case.get("error")
            verify(case)
        except Exception as error:
            failures.append(f"{name}: {type(error).__name__} {error}")

    for name, frames in CORPUS.items():
        def recording(case):
            assert case["frames"] == [frames, frames], case["frames"]
            wav = output / (name + ".wav")
            actual = ff("-i", wav, "-ac", "1", "-f", "s16le", "-")
            assert len(actual) == frames * 2
            # FFmpeg decodes all AAC packets. Materialize the preserved pause and restrict the final access unit.
            # The recorder controls have two channels. Casai uses their arithmetic mean.
            mix = "pan=mono|c0=0.5*c0+0.5*c1"
            flags = ["-c:a", "libopus", "-request_sample_fmt", "flt"] if name.endswith((".ogg", ".webm")) else []
            raw = ff(*flags, "-i", MEDIA / name, "-map", "0:a:0", "-af", mix, "-f", "s16le", "-")
            if "pause" in name:
                raw = raw[:31744*2] + bytes(383*2) + raw[31744*2:]
            reference = raw[:frames*2]
            assert len(reference) == len(actual)
            peak = max(abs(a[0] - b[0]) for a, b in zip(struct.iter_unpack("<h", actual), struct.iter_unpack("<h", reference)))
            case["ffmpegPeakPcm16"] = peak
            assert peak <= 16, (name, peak)
        check(name, recording)

    for name in ["live-prefix-cancel", "android-open-cluster-prefix", "decoder-free", "rejected-copy"]:
        check(name, lambda case: None)
    for name in ["large-open.webm", "large-sized.webm"]:
        def long_cluster(case):
            assert case["firstBytes"] > 0 and case["lockedAfter"] is False
            expected = ff("-copyts", "-i", MEDIA / name, "-c:a", "copy", "-f", "framecrc", "-").splitlines()
            decoded = decoded_hash(MEDIA / name)
            for form in ["blob", "split"]:
                copied = output / (name + "." + form + ".webm")
                packets = ff("-copyts", "-i", copied, "-c:a", "copy", "-f", "framecrc", "-").splitlines()
                assert [r for r in packets if r.startswith(b"0,")] == [r for r in expected if r.startswith(b"0,")]
                assert decoded_hash(copied) == decoded
                copied.unlink()
            assert case["frames"] == [1555200, 1555200], case
        check(name, long_cluster)
    for kind, source in PROFILES.items():
        source_file = MEDIA / source
        source_hash = decoded_hash(source_file)
        packets = packet_manifest(source_file) if kind != "wav" else []
        for form in ["blob", "stream"]:
            name = f"profile-{kind}-{form}"
            def profile(case):
                assert case["repetitions"] >= 2 and case["sourceBytes"] == source_file.stat().st_size
                target = output / (name + "." + kind)
                result_hash = decoded_hash(target)
                case.update(decodedSha256=result_hash, sourceDecodedSha256=source_hash)
                assert result_hash == source_hash, (result_hash, source_hash)
                if packets:
                    copied = packet_manifest(target)
                    assert copied == packets, (len(copied), len(packets))
                    case["copiedPackets"] = len(copied)
                case["providerSha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
                target.unlink()
            check(name, profile)
