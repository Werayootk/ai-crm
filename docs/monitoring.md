# Monitoring notes

สิ่งที่ระบบมีให้ดูแลได้ตอนนี้ และควร alert อะไรเมื่อ deploy จริง (Railway)

## สิ่งที่มีในระบบ

| ที่มา | ใช้ทำอะไร |
|---|---|
| `GET /api/health` (public) | `status` ok/degraded (503 เมื่อต่อ DB ไม่ได้), `db`, โหมด `ai` (claude / fallback) และ `line` (live / mock) — Railway ใช้เป็น healthcheck ของ `api` |
| `GET /healthz` ของ web | healthcheck ของ `web` แยกจาก API (API ล่มแล้ว deploy web ยังผ่าน) |
| `GET /api/ops/summary` (admin) | ตัวเลขที่ควร alert: LINE event ที่ล้ม / ค้าง, ข้อความส่งไม่สำเร็จ, fallback rate และเวลาตอบของ AI (24 ชม.), คำแนะนำที่รออนุมัติ, lead ใหม่ที่ยังไม่มีเจ้าของ |
| log แบบ JSON (pino) | ทุก request มี `reqId` (ส่ง `x-request-id` มาเองได้) — `cookie`, `authorization`, `x-line-signature`, `set-cookie` ถูก redact; ไม่ log body / ข้อความลูกค้า / secret |
| `GET /api/webhook-events` (admin) | ดู event จาก LINE ตามสถานะ + `POST /api/webhook-events/:id/retry` สั่งประมวลผลใหม่ |

## ควร alert อะไร

| สัญญาณ | ดูจาก | เกณฑ์เริ่มต้น | น่าจะเป็นอะไร / ทำอะไรต่อ |
|---|---|---|---|
| ระบบล่ม | uptime monitor ยิง `https://<web>/api/health` ทุก 1–5 นาที | ไม่ได้ 200 ติดกัน 2 ครั้ง | 503 = DB ต่อไม่ได้ (ดู Postgres ใน Railway); ต่อไม่ติดเลย = `web` หรือ `api` ล่ม (ดู deploy log) |
| ลายเซ็น LINE ไม่ผ่าน | log `line webhook rejected: invalid signature` | > 5 ครั้งใน 10 นาที | channel secret ใน Railway ไม่ตรงกับ console (เพิ่ง reissue?) หรือมีคนยิงมั่ว |
| ประมวลผลข้อความ LINE ไม่สำเร็จ | `ops.summary.line.failedEvents` / log `line webhook event failed` | `failedEvents > 0` นาน 15 นาที หรือ `gaveUpEvents > 0` | ดู `lastError` ใน `/api/webhook-events?status=FAILED` → แก้ → กด retry (ระบบ retry เอง 1/5/15/60 นาที) |
| คิวค้าง | `ops.summary.line.stuckEvents` | > 0 | api restart วน / process ค้าง — worker เก็บงานค้างทุก 30 วินาทีอยู่แล้ว ถ้ายังค้างให้ดู log |
| ส่งข้อความหาลูกค้าไม่ได้ | `ops.summary.line.failedMessages` / log `line push failed` | เพิ่มขึ้น | ดู `status` ใน log: 401/403 = token ผิดหรือหมดอายุ, 429 = โควตาข้อความของ OA เต็ม, 5xx = LINE ล่ม (retry เองแล้ว) — ทีมขายกด "ส่งอีกครั้ง" ได้ |
| AI ใช้ไม่ได้ | `ops.summary.ai.fallbackRate` / log `ai suggestions generated` (`fallbackReason`) | > 0.2 ใน 24 ชม. | `no_api_key` = ไม่ได้ตั้ง key, `timeout` = ช้าเกิน `AI_TIMEOUT_MS`, `provider_error` = API ของ Anthropic มีปัญหา / key ถูกยกเลิก — ระบบยังใช้ได้ด้วยกติกาสำรอง |
| AI ช้า | `ops.summary.ai.avgLlmLatencyMs` | > 15,000 ms | ลด `AI_EFFORT` เป็น `low` หรือดูขนาด context |
| งานค้างที่คน | `ai.pendingApprovals`, `leads.unassignedNew` | ตามที่ทีมตกลง | คำแนะนำไม่มีใครอนุมัติ / lead จาก LINE และเว็บยังไม่มีเจ้าของ — เรื่องกระบวนการทีมขาย ไม่ใช่ระบบ |
| error ที่ไม่คาดคิด | log level `error` ข้อความ `unhandled error` | ทุกครั้ง | bug — ใช้ `reqId` ตามดู request นั้น |

ค่าใช้จ่าย AI: log `ai suggestions generated` มี `usage.inputTokens` / `usage.outputTokens` และ `aiModel` ต่อครั้ง — รวมรายวันเพื่อดูแนวโน้ม (ร่างอัตโนมัติจาก LINE ถูกรวบเป็นรอบเดียวเมื่อลูกค้าส่งหลายข้อความติดกัน)

## log ที่ระบบเขียน (ค้นจากข้อความ `msg`)

| ระดับ | ข้อความ | เกิดเมื่อ |
|---|---|---|
| info | `integrations configured` | api start — บอกโหมด AI / LINE และว่าเปิด webhook ไหม |
| info / warn | `login succeeded` / `login failed` | เข้าสู่ระบบ (ไม่ log รหัสผ่าน) |
| info | `lead created`, `lead stage changed`, `contact deleted`, `company deleted` | การเปลี่ยนแปลงสำคัญของ CRM |
| info | `ai suggestions generated`, `ai suggestion approved`, `ai suggestion rejected` | ขอ / อนุมัติ / ไม่ใช้คำแนะนำของ AI |
| info / warn | `line webhook received`, `line webhook rejected: invalid signature` | LINE เรียก webhook |
| info | `contact created from line user`, `line message recorded`, `duplicate line message ignored` | ประมวลผลข้อความ LINE |
| warn | `line profile unavailable — using a placeholder name` | อ่านโปรไฟล์ LINE ไม่ได้ (ยังบันทึกข้อความ) |
| error | `line webhook event failed` | ประมวลผล event ล้ม (มี `attempts`, `nextRetryAt`) |
| info / warn | `line message queued`, `line message sent`, `line push failed` | ส่งข้อความหาลูกค้า |
| warn | `auto ai draft failed` | ร่างอัตโนมัติจาก LINE ล้ม (ข้อความยังอยู่ ขอใหม่จากหน้าเว็บได้) |
| info | `public lead received`, `public lead ignored: honeypot filled` | ฟอร์มหน้าเว็บ |
| warn | `health check: database ping failed` | health ต่อ DB ไม่ได้ |
| error | `unhandled error` | error ที่ไม่ได้คาดไว้ (ตอบ 500 โดยไม่ส่งรายละเอียดออกไป) |

## ยังไม่มี (production next steps)

- error tracking (เช่น Sentry) และ tracing / metrics แบบ OpenTelemetry — ตอนนี้ใช้ log + `/api/ops/summary`
- alert อัตโนมัติ: ต้องตั้งเองใน uptime monitor หรือ cron ที่เรียก `/api/ops/summary` ด้วยบัญชี admin
- log retention / ค้นหาข้าม deploy: ใช้ของ Railway ไปก่อน — ถ้าต้องเก็บนานให้ส่งออกไป log service
