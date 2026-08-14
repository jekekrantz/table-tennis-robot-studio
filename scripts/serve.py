#!/usr/bin/env python3
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"Table Tennis Robot Studio: http://localhost:{port}")
    print("Real BLE Play and Calibration Test Shot are enabled. Preview trace is simulation-only.")
    ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()
