#!/usr/bin/env python3
"""Pocket Pal engine and browser regressions; requires installed Chrome/Chromium."""
import html
import sys
import http.server
import re
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
ROOT = Path(__file__).resolve().parents[1]
browser = next((shutil.which(b) for b in ['google-chrome', 'google-chrome-stable', 'chromium'] if shutil.which(b)), None)
if not browser:
    raise SystemExit('Pocket Pal browser checks require installed Chromium or Chrome.')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *args):
        pass
    def do_GET(self):
        url = urlsplit(self.path)
        fixture = parse_qs(url.query).get('fixture', [''])[0]
        animations = ['wave', 'hop', 'dance', 'tumble', 'butterfly', 'yawn', 'overlord']
        if url.path == '/tamagochi-animations.js' and fixture in animations + ['overlord-timeline']:
            source = (ROOT / 'tamagochi-animations.js').read_text()
            if fixture == 'overlord-timeline':
                source += '''
PocketPalAnimations.create = () => { let start = null; return {interrupt() {start=null;}, tick(now, eligible) {if(!eligible) {start=null;return null;} if(start===null) start=now; return PocketPalAnimations.frame('overlord',2000+now-start);}}; };'''
            else:
                source += "\nPocketPalAnimations.create = () => ({interrupt() {}, tick(now, eligible) {return eligible ? PocketPalAnimations.frame('" + fixture + "', PocketPalAnimations.DEFINITIONS['" + fixture + "'].duration * .4) : null;}});"
            self.respond(source.encode(), 'text/javascript; charset=utf-8')
        elif url.path == '/Tamagochi.html' and 'test' in parse_qs(url.query):
            page = (ROOT / 'Tamagochi.html').read_text()
            injection = '<script>let testSeed=24681357;Math.random=()=>((testSeed=(Math.imul(testSeed,1664525)+1013904223)>>>0)/4294967296);</script>'
            if parse_qs(url.query).get('fixture') == ['no-storage']:
                injection += '<script>Object.defineProperty(window,"localStorage",{get(){throw new Error("Storage disabled");}});</script>'
            page = page.replace('<head>', '<head>' + injection)
            if fixture.startswith('animation-') and fixture[10:] in animations + ['overlord-timeline']:
                page = page.replace('src="tamagochi-animations.js"', 'src="tamagochi-animations.js?fixture=' + fixture[10:] + '"')
            if fixture == 'animation-reduced':
                page = page.replace('src="tamagochi-animations.js"', 'src="tamagochi-animations.js?fixture=dance"')
                page = page.replace('<head>', '<head><script>const nativeMatchMedia=window.matchMedia.bind(window);window.matchMedia=query=>query.includes("prefers-reduced-motion")?{matches:true,addEventListener(){}}:nativeMatchMedia(query);</script>')
            if parse_qs(url.query).get('test') == ['preview']:
                page = page.replace('<head>', '<head><script>localStorage.setItem("pocket-pal-v2",JSON.stringify({version:2,name:"Mochi",age:1000,lastUpdate:Date.now(),fullness:80,happiness:80,energy:90,cleanliness:100,health:100}));</script>')
            self.respond(page.encode(), 'text/html; charset=utf-8')
        else:
            super().do_GET()

    def respond(self, data, content_type):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

def main():
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with tempfile.TemporaryDirectory(prefix='pocket-pal-check-') as profile:
            for page in ['tamagochi.html', 'tamagochi-animations.html']:
                result = subprocess.run([browser, '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', '--disable-sync', '--user-data-dir=' + profile, '--virtual-time-budget=60000', '--dump-dom', f'http://127.0.0.1:{server.server_port}/tests/{page}'], capture_output=True, text=True, timeout=60)
                match = re.search(r'<pre id="report"[^>]*data-result="(pass|fail)"[^>]*>(.*?)</pre>', result.stdout, re.S)
                if not match:
                    print(result.stderr[-3000:]); progress = re.search(r'<pre id="report"[^>]*>(.*?)</pre>', result.stdout, re.S); print(html.unescape(progress.group(1)) if progress else 'No report')
                    raise SystemExit('Browser checks did not finish.\n' + result.stdout[-2000:])
                print(html.unescape(match.group(2)))
                if result.returncode or match.group(1) != 'pass':
                    raise SystemExit(1)
            if '--preview' in sys.argv:
                for animation in ['wave', 'hop', 'dance', 'tumble', 'butterfly', 'yawn', 'overlord']:
                    output = '/tmp/pocket-pal-' + animation + '.png'
                    capture = subprocess.run([browser, '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--disable-background-networking', '--user-data-dir=' + profile, '--window-size=1100,1000', '--virtual-time-budget=1000', '--screenshot=' + output, f'http://127.0.0.1:{server.server_port}/Tamagochi.html?test=preview&fixture=animation-{animation}'], capture_output=True, text=True, timeout=30)
                    if capture.returncode:
                        raise SystemExit('Preview capture failed: ' + capture.stderr[-1000:])
                    print('Preview: ' + output)
    finally:
        server.shutdown()
        server.server_close()

if __name__ == "__main__":
    main()
