#!/bin/sh
set -eu

PORT="${PORT:-3000}"

# 用 python 启动健康检查服务（Alpine 自带 python3）
echo "[startup] Starting health server on port ${PORT}"
python3 -c "
import http.server, socketserver, os
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/list' or self.path == '/sub':
            try:
                with open('/app/worlds/list.log','rb') as f: data=f.read()
            except: data=b''
            self.send_response(200)
            self.send_header('Content-Type','text/plain')
            self.send_header('Content-Length',str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(200)
            self.send_header('Content-Type','text/plain')
            self.end_headers()
            self.wfile.write(b'hello world')
    def do_POST(self):
        self.do_GET()
    def log_message(self, *a):
        pass
socketserver.TCPServer(('0.0.0.0', int(os.environ.get('PORT','3000'))), H).serve_forever()
" &
HTTP_PID=$!

cleanup() {
    echo "[shutdown] Stopping services"
    kill "${WANJU_PID:-}" 2>/dev/null || true
    kill "${HTTP_PID:-}" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "[startup] Starting Wanju node"
echo "[startup] Protocol: ${TMP_ARGO:-vms}"
echo "[startup] Proxy port: ${VM_PORT:-8040}"
echo "[startup] Argo domain: ${ARGO_DOMAIN:-not-set}"
echo "[startup] Nezha server: ${NEZHA_SERVER:-not-set}"

/usr/local/bin/wanju &
WANJU_PID=$!

# 等待 wanju 生成 list.log，然后持续监控
wait "${WANJU_PID}" 2>/dev/null
EXIT_CODE=$?
echo "[error] Wanju process exited with code ${EXIT_CODE}"
exit "${EXIT_CODE}"
