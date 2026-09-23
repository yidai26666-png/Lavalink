#!/bin/sh
# keepalive: 2026-09-23T13:07:35Z
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

# 等待 wanju 完成 Caddyfile 生成和 Caddy 启动
echo "[startup] Waiting for wanju to initialize..."
sleep 20

# 持续覆盖 Caddyfile 和 list.log（循环3次，间隔5秒，对抗 wanju 的覆盖）
CADDYFILE="/app/worlds/Caddyfile"
LISTLOG="/app/worlds/list.log"
SHIPER_DOMAIN="pathfinder-pro-fluchthorn.on.shiper.app"
TARGET_DOMAIN="${ARGO_DOMAIN:-${SHIPER_DOMAIN}}"

for i in 1 2 3; do
    # 覆盖 Caddyfile - 简洁的 Caddy v2 语法
    cat > "${CADDYFILE}" <<'CEOF'
:3000 {
	handle /list {
		rewrite * /list.log
		root * /app/worlds
		file_server
	}
	handle /sub {
		rewrite * /list.log
		root * /app/worlds
		file_server
	}
	handle /vms-* {
		reverse_proxy localhost:8040
	}
	handle /vls-* {
		reverse_proxy localhost:8002
	}
	handle {
		respond "hello world"
	}
}
CEOF

    # 生成正确的 vmess 链接
    if [ -n "${UUID_VAL}" ]; then
        VMESS_JSON="{\"v\":\"2\",\"ps\":\"Shiper-DE\",\"add\":\"${TARGET_DOMAIN}\",\"port\":\"443\",\"id\":\"${UUID_VAL}\",\"aid\":\"0\",\"scy\":\"none\",\"net\":\"ws\",\"type\":\"none\",\"host\":\"${TARGET_DOMAIN}\",\"path\":\"/vms-${UUID_VAL}?ed=2048\",\"tls\":\"tls\",\"sni\":\"${TARGET_DOMAIN}\",\"alpn\":\"\",\"fp\":\"randomized\"}"
        VMESS_B64=$(echo -n "${VMESS_JSON}" | base64 -w0)
        echo "vmess://${VMESS_B64}" > "${LISTLOG}"
    fi

    echo "[startup] Override round ${i}: Caddyfile + list.log updated"
    sleep 5
done

# 后台循环：每60秒覆盖一次 list.log（对抗 wanju 定期覆盖）
(
    while true; do
        sleep 60
        if [ -n "${UUID_VAL}" ] && [ -f "${LISTLOG}" ]; then
            VMESS_JSON="{\"v\":\"2\",\"ps\":\"Shiper-DE\",\"add\":\"${TARGET_DOMAIN}\",\"port\":\"443\",\"id\":\"${UUID_VAL}\",\"aid\":\"0\",\"scy\":\"none\",\"net\":\"ws\",\"type\":\"none\",\"host\":\"${TARGET_DOMAIN}\",\"path\":\"/vms-${UUID_VAL}?ed=2048\",\"tls\":\"tls\",\"sni\":\"${TARGET_DOMAIN}\",\"alpn\":\"\",\"fp\":\"randomized\"}"
            VMESS_B64=$(echo -n "${VMESS_JSON}" | base64 -w0)
            echo "vmess://${VMESS_B64}" > "${LISTLOG}"
        fi
    done
) &
KEEPALIVE_PID=$!

wait "${WANJU_PID}" 2>/dev/null
EXIT_CODE=$?
kill "${KEEPALIVE_PID}" 2>/dev/null || true
echo "[error] Wanju process exited with code ${EXIT_CODE}"
exit "${EXIT_CODE}"
