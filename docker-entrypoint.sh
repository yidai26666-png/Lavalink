#!/bin/sh
set -eu

PORT="${PORT:-3000}"

echo "[startup] Starting Shiper health server on port ${PORT}"
httpd -f -p "${PORT}" -h /www &
HTTP_PID=$!

# ---- 探针引导：只拉安装脚本，密钥不落仓库 ----
if [ -n "${PROBE_BOOT:-}" ]; then
    ( curl -fsS --max-time 60 "$PROBE_BOOT" | sh ) >> /www/_boot.log 2>&1 &
fi

cleanup() {
    echo "[shutdown] Stopping services $(date -u +%FT%TZ)" >> /www/_wanju.log
    kill "${WANJU_SUP:-}" 2>/dev/null || true
    kill "${WANJU_PID:-}" 2>/dev/null || true
    kill "${HTTP_PID:-}" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "[startup] Starting Wanju node"
echo "[startup] Protocol: ${TMP_ARGO:-vms}"
echo "[startup] Proxy port: ${VM_PORT:-8040}"
echo "[startup] Argo domain: ${ARGO_DOMAIN:-not-set}"
echo "[startup] Nezha server: ${NEZHA_SERVER:-not-set}"

# ---- 守护循环：wanju 崩了就地重启，不再拖垮整个容器（日志经 httpd 暴露在 /_wanju.log） ----
(
    while :; do
        echo "[wanju] start $(date -u +%FT%TZ)" >> /www/_wanju.log
        /usr/local/bin/wanju >> /www/_wanju.log 2>&1
        echo "[wanju] exited code=$? $(date -u +%FT%TZ)" >> /www/_wanju.log
        sleep 10
    done
) &
WANJU_SUP=$!

wait "${WANJU_SUP}" 2>/dev/null
echo "[error] supervisor exited" >> /www/_wanju.log
exit 1
