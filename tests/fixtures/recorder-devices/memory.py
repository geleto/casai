import json
import re
import subprocess
import time
from threading import Event, Thread


class Memory:
    def __init__(self, platform, output):
        self.platform = platform
        self.output = output
        self.profiles = {}
        self.stop = None

    def snapshot(self):
        if self.platform == "local":
            return {}
        if self.platform == "android":
            text = subprocess.check_output(["adb", "shell", "dumpsys", "meminfo"], text=True, timeout=20)
            section = re.search(r"(?ims)^\s*Total PSS by process:\s*\n(.+?)(?=\n\s*Total [^\n]+:|\Z)", text)
            if not section:
                (self.output / "android-meminfo.txt").write_text(text)
                raise ValueError("Missing OS process PSS")
            rows = re.findall(r"([\d,]+)K:\s+([^\n(]*com\.android\.chrome[^\n(]*)\(pid\s+(\d+)", section[1])
            return {pid: [name.strip(), int(kb.replace(",", ""))] for kb, name, pid in rows}
        text = subprocess.check_output(["ps", "-axo", "pid=,rss=,comm="], text=True, timeout=15)
        processes = {}
        for row in text.splitlines():
            fields = row.strip().split(None, 2)
            if len(fields) != 3:
                continue
            pid, kb, path = fields
            executable = path.rsplit("/", 1)[-1]
            if not (re.search(r"^(?:MobileSafari|Safari|com\.apple\.WebKit\.(?:WebContent|Networking|GPU).*|WebKit(?:WebContent|Networking|GPU).*|WebContent|NetworkingExtension|GPUExtension|WebContentExtension)$", executable)):
                continue
            is_sim = "CoreSimulator" in path or "iOS.simruntime" in path
            if is_sim == (self.platform == "ios"):
                processes[pid] = [path, int(kb)]
        if not processes:
            (self.output / "webkit-ps.txt").write_text("\n".join(row for row in text.splitlines() if re.search("safari|webkit|webcontent|coreSimulator", row, re.I)))
        return processes

    def sample(self, profile, phase):
        try:
            values = self.snapshot()
            profile.append({"time": time.monotonic(), "phase": phase, "KiB": sum(row[1] for row in values.values()), "processes": values})
        except Exception as error:
            profile.append({"phase": phase, "error": str(error)})

    def begin(self, name):
        if self.platform == "local":
            return
        profile = self.profiles[name] = []
        self.sample(profile, "before")
        self.stop = Event()
        def loop():
            while not self.stop.is_set():
                self.sample(profile, "during")
                self.stop.wait(0.15)
        self.thread = Thread(target=loop, daemon=True)
        self.thread.start()

    def end(self, name):
        if not self.stop:
            return
        self.stop.set()
        self.thread.join()
        self.stop = None
        self.sample(self.profiles[name], "after")
        (self.output / "memory-samples.json").write_text(json.dumps(self.profiles, indent=2))

    def summarize(self):
        result = {}
        for name, rows in self.profiles.items():
            active = [row["KiB"] for row in rows if row.get("phase") == "during" and row.get("KiB")]
            if not rows[0].get("KiB") or not active or not rows[-1].get("KiB"):
                raise ValueError("Missing browser memory observations for " + name)
            result[name] = {"baselineKiB": rows[0]["KiB"], "peakKiB": max(active), "increaseKiB": max(0, max(active) - rows[0]["KiB"]),
                            "afterKiB": rows[-1]["KiB"], "samples": len(active)}
        return result
