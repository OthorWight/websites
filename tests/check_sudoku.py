#!/usr/bin/env python3
"""Run Standard/Killer Sudoku engine and UI regressions with installed Chrome.
Usage: python3 tests/check_sudoku.py — no npm or third-party Python packages needed.
"""
import http.server
import subprocess
import tempfile
import threading
import shutil
import re
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
ROOT = Path(__file__).resolve().parents[1]
browser = next((shutil.which(name) for name in ['google-chrome', 'google-chrome-stable', 'chromium'] if shutil.which(name)), None)
if not browser:
    raise SystemExit('Sudoku browser checks require installed Chromium or Chrome.')

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *args):
        pass
    def do_GET(self):
        request = urlsplit(self.path)
        fixture = parse_qs(request.query).get('fixture', [''])[0]
        if request.path == '/Sudoku.html' and fixture in ['missing-core', 'no-storage']:
            page = (ROOT / 'Sudoku.html').read_text()
            if fixture == 'missing-core':
                page = page.replace('src="sudoku-core.js"', 'src="missing-core.js"')
            else:
                page = page.replace('<head>', '<head><script>Object.defineProperty(window, "localStorage", {get() {throw new Error("Storage disabled");}});</script>')
            data = page.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            super().do_GET()

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with tempfile.TemporaryDirectory(prefix='sudoku-check-') as profile:
        result = subprocess.run([
            browser, '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
            '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
            '--disable-extensions', '--disable-sync',
            '--user-data-dir=' + profile, '--virtual-time-budget=60000', '--dump-dom',
            f'http://127.0.0.1:{server.server_port}/tests/sudoku.html'
        ], capture_output=True, text=True, timeout=60)
        match = re.search(r'<pre id="report"[^>]*data-result="(pass|fail)"[^>]*>(.*?)</pre>', result.stdout, re.S)
        if not match:
            print(result.stderr[-4000:])
            raise SystemExit('Browser checks did not finish.\n' + result.stdout[-2000:])
        import html
        print(html.unescape(match.group(2)))
        if result.returncode or match.group(1) != 'pass':
            raise SystemExit(1)
finally:
    server.shutdown()
    server.server_close()
