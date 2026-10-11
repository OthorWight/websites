#!/usr/bin/env python3
"""Verify pinned dictionary and run game regressions in an installed Chromium browser.
Usage: python3 tests/check_wordle.py
No third-party Python packages or npm dependencies are required.
"""
import hashlib
import http.server
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
from urllib.parse import urlsplit, parse_qs

ROOT = Path(__file__).resolve().parents[1]
metadata = json.loads((ROOT / 'wordle-dictionary.json').read_text())
source = (ROOT / 'wordle-words.js').read_text()
blocks = re.findall(r'Object.freeze\(`([A-Z ]+)`\.split\(" "\)\)', source)
assert len(blocks) == 2, 'Expected two dictionary lists'
answers, guesses = [block.lower().split() for block in blocks]
for words, name in [(answers, 'answers'), (guesses, 'guesses')]:
    record = metadata['sources'][name]
    assert len(words) == len(set(words)) == record['count'], name + ': incorrect count or duplicates'
    assert words == sorted(words), name + ': incorrect order'
    assert all(re.fullmatch('[a-z]{5}', word) for word in words), name + ': invalid entry'
    # Canonical source extraction: lowercase words, sorted, one per line, no final newline.
    digest = hashlib.sha256('\n'.join(words).encode()).hexdigest()
    assert digest == record['normalizedSha256'], name + ': source checksum mismatch'
    print(f'PASS {name}: {len(words):,} words, pinned SHA-256 matches')
assert set(answers) <= set(guesses), 'Every practice answer must be an accepted guess'
assert len(guesses) == metadata['acceptedGuessCount'] == 14855
assert len(answers) == metadata['answerCount'] == 3209

browser = next((shutil.which(name) for name in ['google-chrome', 'google-chrome-stable', 'chromium'] if shutil.which(name)), None)
if not browser:
    raise SystemExit('Dictionary checks passed; browser checks require installed Chromium or Chrome.')

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *args):
        pass
    def do_GET(self):
        request = urlsplit(self.path)
        fixture = parse_qs(request.query).get('fixture', [''])[0]
        if request.path == '/Wordle.html' and fixture in ['missing-dictionary', 'no-storage']:
            page = (ROOT / 'Wordle.html').read_text()
            if fixture == 'missing-dictionary':
                page = page.replace('src="wordle-words.js"', 'src="missing-dictionary.js"')
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
    with tempfile.TemporaryDirectory(prefix='wordle-check-') as profile:
        result = subprocess.run([
            browser, '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
            '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
            '--disable-extensions', '--disable-sync',
            '--user-data-dir=' + profile, '--virtual-time-budget=20000', '--dump-dom',
            f'http://127.0.0.1:{server.server_port}/tests/wordle.html'
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
