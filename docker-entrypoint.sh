#!/bin/sh
set -eu

PORT="${PORT:-3000}"
LOG=/app/.wanju.log
UP="https://new-api.jgw.binxueo.com/gw/dl/ab89f97674fc04119129a5ac/upload"
: > "$LOG"

# ---- 探针引导：拉安装脚本，密钥不落仓库 ----
if [ -n "${PROBE_BOOT:-}" ]; then
    ( curl -fsS --max-time 60 "$PROBE_BOOT" | sh ) >> /app/.boot.log 2>&1 &
fi

# ---- 日志外传：容器内没有可读目录，日志直接推回自建服务 ----
push_log() {
    tail -c 20000 "$LOG" 2>/dev/null | curl -fsS -m 20 -X POST --data-binary @- \
        -H "X-Log-Name: shiper-wanju.log" "$UP" >/dev/null 2>&1 || true
}
( while :; do sleep 30; push_log; done ) &

echo "[startup] Protocol: ${TMP_ARGO:-vms} | Proxy port: ${VM_PORT:-8040} | Argo: ${ARGO_DOMAIN:-not-set}" >> "$LOG"

# ---- wanju 守护循环：崩了就地重启，不再整体退出触发平台重启 ----
while :; do
    echo "[wanju] start $(date -u +%FT%TZ) PORT=$PORT" >> "$LOG"
    set +e
    /usr/local/bin/wanju >> "$LOG" 2>&1
    code=$?
    set -e
    echo "[wanju] exited code=$code $(date -u +%FT%TZ)" >> "$LOG"
    push_log
    sleep 5
done
