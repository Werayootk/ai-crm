#!/usr/bin/env bash
# dev stack ของ ai-crm: Postgres (Docker) + `pnpm dev` (web :3000, api :4000)
#   stack.sh up      เปิด (env ที่ส่งมา เช่น LINE_CHANNEL_SECRET=… ส่งต่อให้ api — dotenv ไม่ทับค่าที่มีอยู่)
#   stack.sh down    ปิดทั้ง process group (pnpm → tsx watch / next dev) และทุกตัวที่จับพอร์ต 3000/4000
#   stack.sh status  ดูว่ามีอะไรจับพอร์ตอยู่ + health
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

LOG=${AI_CRM_LOG:-/tmp/ai-crm-dev.log}
PGID_FILE=/tmp/ai-crm-dev.pgid

listeners() {
  { lsof -tiTCP:3000 -sTCP:LISTEN; lsof -tiTCP:4000 -sTCP:LISTEN; } 2>/dev/null || true
}

case "${1:-status}" in
  up)
    if [ -n "$(listeners)" ]; then
      echo "port 3000/4000 ถูกใช้อยู่ — ดู: lsof -iTCP:4000 -sTCP:LISTEN -n -P แล้วรัน: $0 down"
      exit 1
    fi
    pnpm -s db:up >/dev/null
    # set -m: job ถัดไปได้ process group ของตัวเอง → down ฆ่าทั้งกลุ่มได้ (macOS ไม่มี setsid)
    set -m
    nohup pnpm dev >"$LOG" 2>&1 &
    echo $! >"$PGID_FILE"
    set +m
    for _ in $(seq 1 120); do
      if curl -sf http://localhost:4000/api/health >/dev/null &&
        curl -sf -o /dev/null http://localhost:3000/login; then
        curl -s http://localhost:3000/api/health
        echo
        echo "ready — log: $LOG"
        exit 0
      fi
      sleep 1
    done
    echo "ยังไม่พร้อมหลัง 120 วินาที — ท้าย log:"
    tail -20 "$LOG"
    exit 1
    ;;
  down)
    if [ -f "$PGID_FILE" ]; then
      kill -TERM -- "-$(cat "$PGID_FILE")" 2>/dev/null || true
      rm -f "$PGID_FILE"
    fi
    for _ in $(seq 1 20); do
      [ -z "$(listeners)" ] && break
      sleep 0.5
    done
    # ตัวที่ค้างจากรอบที่ไม่ได้เปิดผ่านสคริปต์นี้
    for pid in $(listeners); do kill "$pid" 2>/dev/null || true; done
    echo "stopped (Postgres ยังรันอยู่ — ปิดด้วย pnpm db:down)"
    ;;
  status)
    lsof -iTCP:3000 -iTCP:4000 -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR > 1 { print $1, $2, $9 }' || true
    curl -s http://localhost:3000/api/health || echo "web/api not responding"
    echo
    ;;
  *)
    echo "usage: $0 up|down|status"
    exit 2
    ;;
esac
