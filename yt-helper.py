#!/usr/bin/env python3
# License: MIT — see LICENSE
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs, unquote
import subprocess, json, os, threading, uuid, pathlib, time

DOWNLOAD_DIR = pathlib.Path.home() / "Downloads" / "YouTube"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
JOBS = {}
LOCK = threading.Lock()

def run_job(job_id, url, fmt):
    cmd = ["yt-dlp", "-f", fmt, "--merge-output-format", "mp4",
           "-o", str(DOWNLOAD_DIR / "%(title)s.%(ext)s"),
           "--no-playlist", "--newline", "--no-mtime", url]
    with LOCK:
        JOBS[job_id] = {"status": "running", "file": None, "log": [],
                        "title": "fetching…", "url": url, "fmt": fmt,
                        "started": time.time(), "pid": None}
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True)
        with LOCK: JOBS[job_id]["pid"] = proc.pid
        for line in proc.stdout:
            line = line.rstrip()
            with LOCK:
                JOBS[job_id]["log"].append(line)
                if len(JOBS[job_id]["log"]) > 200:
                    JOBS[job_id]["log"] = JOBS[job_id]["log"][-200:]
                if "[youtube]" in line and ":" in line and "Downloading" not in line:
                    tail = line.split(":", 1)[-1].strip()
                    if tail and not JOBS[job_id]["title"]:
                        JOBS[job_id]["title"] = tail[:80]
        proc.wait()
        with LOCK:
            if JOBS[job_id]["status"] != "cancelled":
                JOBS[job_id]["status"] = "done" if proc.returncode == 0 else "error"
            files = sorted(DOWNLOAD_DIR.glob("*.mp4"), key=os.path.getmtime, reverse=True)
            JOBS[job_id]["file"] = str(files[0]) if files else None
    except Exception as e:
        with LOCK:
            JOBS[job_id]["status"] = "error"
            JOBS[job_id]["log"].append(str(e))

def cancel_job(job_id):
    with LOCK:
        j = JOBS.get(job_id)
        if not j: return False
        pid = j.get("pid"); j["status"] = "cancelled"
    if pid:
        try:
            os.kill(pid, 15); time.sleep(0.3); os.kill(pid, 9)
        except ProcessLookupError: pass
    return True

class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS")
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def _json(self, code, obj):
        self.send_response(code); self._cors()
        self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(obj).encode())
    def log_message(self, *a): return
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        if self.path.startswith("/formats"):
            url = unquote(q.get("url", [""])[0])
            try:
                out = subprocess.check_output(["yt-dlp", "-J", "--no-playlist", url], text=True, timeout=90)
                info = json.loads(out); fmts = []
                for f in info.get("formats", []):
                    if f.get("vcodec") == "none": continue
                    if f.get("ext") in ("mhtml", "none"): continue
                    if "storyboard" in (f.get("format_note") or "").lower(): continue
                    fmts.append({"id": f["format_id"],
                                 "label": f.get("format_note") or f.get("resolution") or f["format_id"],
                                 "ext": f.get("ext"), "height": f.get("height") or 0,
                                 "acodec": f.get("acodec"), "vcodec": f.get("vcodec")})
                seen = {}
                for f in fmts:
                    k = (f["height"], f["ext"])
                    if k not in seen: seen[k] = f
                fmts = sorted(seen.values(), key=lambda x: -(x["height"] or 0))
                self._json(200, {"title": info.get("title"), "formats": fmts})
            except Exception as e:
                self._json(500, {"error": str(e)})
            return
        if self.path.startswith("/status"):
            jid = q.get("id", [""])[0]
            with LOCK: self._json(200, JOBS.get(jid, {"status": "unknown"}))
            return
        if self.path.startswith("/jobs"):
            with LOCK:
                jobs = {k: {"status": v["status"], "file": v["file"],
                            "title": v.get("title") or "", "url": v.get("url"),
                            "fmt": v.get("fmt"), "started": v.get("started"),
                            "last": (v["log"][-1] if v["log"] else "")}
                        for k, v in JOBS.items()}
            self._json(200, jobs); return
        self.send_response(404); self._cors(); self.end_headers()
    def do_POST(self):
        if self.path.startswith("/download"):
            q = parse_qs(urlparse(self.path).query)
            url = unquote(q.get("url", [""])[0])
            fmt = q.get("fmt", ["bestvideo[height<=1080]+bestaudio/best"])[0]
            if fmt and "+" not in fmt and fmt not in ("best",):
                fmt = fmt + "+bestaudio/best"
            jid = uuid.uuid4().hex[:8]
            threading.Thread(target=run_job, args=(jid, url, fmt), daemon=True).start()
            self._json(200, {"job": jid, "dir": str(DOWNLOAD_DIR)}); return
        if self.path.startswith("/cancel"):
            jid = parse_qs(urlparse(self.path).query).get("id", [""])[0]
            self._json(200 if cancel_job(jid) else 404, {"cancelled": True}); return
        if self.path.startswith("/clear"):
            with LOCK:
                for k in list(JOBS.keys()):
                    if JOBS[k]["status"] in ("done", "error", "cancelled"):
                        del JOBS[k]
            self._json(200, {"cleared": True}); return
        self.send_response(404); self._cors(); self.end_headers()

if __name__ == "__main__":
    print(f"Helper running on http://127.0.0.1:8765  ->  {DOWNLOAD_DIR}")
    HTTPServer(("127.0.0.1", 8765), H).serve_forever()
