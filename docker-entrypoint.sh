#!/bin/sh
set -eu

PORT="${PORT:-3000}"
VMS_PORT="${VM_PORT:-8040}"
ARGO_DOMAIN="${ARGO_DOMAIN:-}"
NEZHA_SERVER="${NEZHA_SERVER:-}"
NEZHA_KEY="${NEZHA_KEY:-}"
UUID_VAL="${UUID:-}"

echo "[startup] Starting health server on port ${PORT}"
python3 -c "
import http.server, socketserver, os, time
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ('/list', '/sub', '/list.log', '/subscribe'):
            try:
                with open('/app/worlds/list.log','rb') as f: data=f.read()
            except: data=b''
            self.send_response(200)
            self.send_header('Content-Type','text/plain; charset=utf-8')
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
    kill "${CADDY_PID:-}" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "[startup] Starting Wanju node"
echo "[startup] Protocol: ${TMP_ARGO:-vms}"
echo "[startup] Proxy port: ${VMS_PORT}"
echo "[startup] Argo domain: ${ARGO_DOMAIN:-not-set}"
echo "[startup] Nezha server: ${NEZHA_SERVER:-not-set}"
echo "[startup] UUID: ${UUID_VAL:-auto}"

/usr/local/bin/wanju &
WANJU_PID=$!

# 等待 wanju 完成初始化并生成 Caddyfile
echo "[startup] Waiting for wanju to initialize..."
sleep 15

# 生成自定义 Caddyfile，正确路由 /list 和 WebSocket
CADDYFILE="/app/worlds/Caddyfile"
if [ -d "/app/worlds" ]; then
    cat > "${CADDYFILE}" <<CEOF
:3000 {
    @ws {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @ws localhost:${VMS_PORT}
    
    handle /list {
        file_response /app/worlds/list.log
    }
    handle /sub {
        file_response /app/worlds/list.log
    }
    handle {
        respond "hello world"
    }
}
CEOF
    echo "[startup] Caddyfile overwritten with WS proxy to :${VMS_PORT}"
    
    # Caddy 会通过 watcher 自动检测文件变更并 reload
    # 如果没有 watcher，需要 kill 旧 Caddy 让 wanju 重新启动它
    # 但 wanju 的 Caddy 有 watcher（日志中可见），所以应该自动 reload
fi

# 如果 list.log 为空，生成一个手动节点链接
LISTLOG="/app/worlds/list.log"
if [ -f "${LISTLOG}" ] && [ ! -s "${LISTLOG}" ]; then
    SHIPER_DOMAIN="pathfinder-pro-fluchthorn.on.shiper.app"
    if [ -n "${ARGO_DOMAIN}" ]; then
        TARGET_DOMAIN="${ARGO_DOMAIN}"
    else
        TARGET_DOMAIN="${SHIPER_DOMAIN}"
    fi
    
    if [ -n "${UUID_VAL}" ]; then
        VMESS_LINK="vmess://$(echo -n '{"v":"2","ps":"Shiper","add":"'"${TARGET_DOMAIN}"'","port":"443","id":"'"${UUID_VAL}"'","aid":"0","net":"ws","type":"none","host":"'"${TARGET_DOMAIN}"'","path":"/","tls":"tls"}' | base64 -w0)"
        echo "${VMESS_LINK}" > "${LISTLOG}"
        echo "[startup] Generated vmess link in list.log"
    fi
fi

wait "${WANJU_PID}" 2>/dev/null
EXIT_CODE=$?
echo "[error] Wanju process exited with code ${EXIT_CODE}"
exit "${EXIT_CODE}"
