"""Servidor estático de desarrollo sin caché: los cambios se ven al recargar. Uso: python3 serve.py [puerto]"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = partial(NoCacheHandler, directory=str(Path(__file__).resolve().parent))
    ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()
