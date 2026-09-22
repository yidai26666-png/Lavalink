#!/bin/sh
set -eu

PORT="${PORT:-3000}"

echo "[startup] Starting Shiper health server on port ${PORT}"
busybox httpd -f -p "${PORT}" -h /www &
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

wait "${WANJU_PID}" 2>/dev/null
EXIT_CODE=$?
echo "[error] Wanju process exited with code ${EXIT_CODE}"
exit "${EXIT_CODE}"
