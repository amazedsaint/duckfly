"""Serve the built app with one failed startup asset for visible-error acceptance.

Run from the repository root, then open http://127.0.0.1:5198/.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?', 1)[0] == '/assets/scene.json.gz':
            self.send_error(503, 'Acceptance: robot asset unavailable')
        else:
            super().do_GET()

    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[3] / 'web' / 'dist'
    ThreadingHTTPServer(('127.0.0.1', 5198), partial(Handler, directory=root)).serve_forever()
