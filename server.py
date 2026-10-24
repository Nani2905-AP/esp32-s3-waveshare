import http.server
import socketserver
import os
import sys

PORT = 7883
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        httpd.serve_forever()
except OSError as e:
    print(f"Error: Port {PORT} may be in use or unavailable: {e}")
    sys.exit(1)