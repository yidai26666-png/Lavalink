#!/bin/sh
set -eu

PORT="${PORT:-3000}"
VMS_PORT="${VM_PORT:-8040}"
ARGO_DOMAIN="${ARGO_DOMAIN:-}"
NEZHA_SERVER="${NEZHA_SERVER:-}"
NEZHA_KEY="${NEZHA_KEY:-}"
UUID_VAL="${UUID:-}"

cleanup() {
    echo "[shutdown] Stopping services"
    kill "${WANJU_PID:-}" 2>/dev/null || true
    kill "${CADDY_PID:-}" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "[startup] Starting Wanju node (no httpd, letting Caddy own :3000)"
echo "[startup] Protocol: ${TMP_ARGO:-vms}"
echo "[startup] Proxy port: ${VMS_PORT}"
echo "[startup] Argo domain: ${ARGO_DOMAIN:-not-set}"
echo "[startup] Nezha server: ${NEZHA_SERVER:-not-set}"
echo "[startup] UUID: ${UUID_VAL:-auto}"

/usr/local/bin/wanju &
WANJU_PID=$!

# 等待 wanju 完成 Caddyfile 生成和 Caddy 启动
echo "[startup] Waiting for wanju to initialize..."
sleep 20

# 覆盖 Caddyfile，正确配置 WebSocket 反代和 /list 路由
CADDYFILE="/app/worlds/Caddyfile"
if [ -d "/app/worlds" ]; then
    cat > "${CADDYFILE}" <<'CEOF'
:3000 {
	@ws {
		header Connection *Upgrade*
		header Upgrade websocket
	}
	reverse_proxy @ws localhost:8040

	handle /list* {
		root * /app/worlds
		rewrite * /list.log
		file_server
	}
	handle /sub* {
		root * /app/worlds
		rewrite * /list.log
		file_server
	}
	handle {
		respond "hello world"
	}
}
CEOF
    echo "[startup] Caddyfile overwritten with WS proxy + /list routing"
fi

# 生成正确的 vmess 链接到 list.log
LISTLOG="/app/worlds/list.log"
SHIPER_DOMAIN="pathfinder-pro-fluchthorn.on.shiper.app"
TARGET_DOMAIN="${ARGO_DOMAIN:-${SHIPER_DOMAIN}}"

if [ -n "${UUID_VAL}" ]; then
    VMESS_JSON="{\"v\":\"2\",\"ps\":\"🇩🇪 Shiper\",\"add\":\"${TARGET_DOMAIN}\",\"port\":\"443\",\"id\":\"${UUID_VAL}\",\"aid\":\"0\",\"scy\":\"none\",\"net\":\"ws\",\"type\":\"none\",\"host\":\"${TARGET_DOMAIN}\",\"path\":\"/vms-${UUID_VAL}?ed=2048\",\"tls\":\"tls\",\"sni\":\"${TARGET_DOMAIN}\",\"alpn\":\"\",\"fp\":\"randomized\"}"
    VMESS_B64=$(echo -n "${VMESS_JSON}" | base64 -w0)
    echo "vmess://${VMESS_B64}" > "${LISTLOG}"
    echo "[startup] Generated vmess link in list.log with domain ${TARGET_DOMAIN}"
fi

# Caddy watcher 会自动检测 Caddyfile 变更并 reload
# 如果 Caddy 之前因端口冲突失败，现在 :3000 空闲了，需要重启
# 检查 Caddy 是否在运行
if ! pgrep -x caddy > /dev/null 2>&1; then
    echo "[startup] Caddy not running, starting manually"
    if [ -x /app/worlds/caddy ]; then
        /app/worlds/caddy run --config "${CADDYFILE}" &
        CADDY_PID=$!
    fi
fi

wait "${WANJU_PID}" 2>/dev/null
EXIT_CODE=$?
echo "[error] Wanju process exited with code ${EXIT_CODE}"
exit "${EXIT_CODE}"
