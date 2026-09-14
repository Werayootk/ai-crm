---
name: run-ai-crm
description: Start, run, drive, and screenshot the ai-crm app (Next.js web + Express API + Postgres) locally, simulate LINE OA messages, check the production Docker image, and run its tests. Use when asked to run or start the CRM, open a page and take a screenshot, click through a flow (login, leads, AI Copilot approval, LINE inbound reply, contact form), verify a change in the real app, or run the test suite — เปิด / รัน / ทดสอบ / ถ่ายภาพหน้าจอแอป ai-crm
---

# Run ai-crm

เปิด dev stack ด้วย `.claude/skills/run-ai-crm/stack.sh` (Postgres ใน Docker + `pnpm dev`: web :3000, api :4000) แล้วขับเว็บด้วย `.claude/skills/run-ai-crm/driver.mjs` — Chrome จริงแบบ headless ผ่าน `playwright-core` รับคำสั่งทาง stdin บรรทัดละคำสั่ง ถ่ายภาพลง `/tmp/ai-crm-shots/` และจบด้วยรายการ console error / HTTP 404-5xx (มีปัญหา = exit 1)

path ทั้งหมดในหน้านี้นับจาก root ของ repo

## Prerequisites

ตรวจแล้วบน macOS 26.6: Node 22.22 (nvm), pnpm 11.20, Docker Desktop 29.7 (daemon ต้องรันอยู่), Google Chrome ใน `/Applications` (driver ใช้ `channel: 'chrome'` — ไม่ดาวน์โหลด browser) — ยังไม่เคยลองบน Linux

`apps/api/.env` ต้องมีอยู่แล้ว (คัดลอกจาก `apps/api/.env.example` แล้วตั้ง `SEED_DEMO_PASSWORD` ≥ 12 ตัวและ `JWT_SECRET` — ดู README → Quick start) driver อ่าน `SEED_DEMO_PASSWORD` จากไฟล์นี้เพื่อ login

## Setup (ครั้งแรก หรือเมื่อ volume ของ Docker หายไป)

```bash
pnpm install
npm install --prefix .claude/skills/run-ai-crm      # dependency ของ driver (playwright-core) — แยกจาก pnpm workspace
pnpm db:up && pnpm db:generate && pnpm db:deploy && pnpm db:seed
```

seed ได้ 20 users / 2,000 contacts / 450 leads และไม่ยอมรันกับ DB ที่มีข้อมูลแล้ว (ต้องสั่ง `pnpm db:seed -- --reset` เองซึ่งล้างข้อมูลเดิม)

## Run (agent path)

```bash
openssl rand -hex 16 > /tmp/ai-crm-line-secret                       # channel secret ชั่วคราว (ใช้ทั้งตอนเปิด api และตอน simulate)
LINE_CHANNEL_SECRET=$(cat /tmp/ai-crm-line-secret) .claude/skills/run-ai-crm/stack.sh up
```

`up` ปฏิเสธถ้ามีอะไรจับพอร์ต 3000/4000 อยู่ รอจน `/api/health` และ `/login` ตอบ แล้วพิมพ์ health (`"ai":"fallback"` = ไม่มี `ANTHROPIC_API_KEY`, `"line":"mock"` = ข้อความขาออกไม่ถึงใคร) — log อยู่ที่ `/tmp/ai-crm-dev.log` ส่ง env อื่นให้ api แบบเดียวกันได้ (dotenv ไม่ทับค่าที่มีอยู่ ไม่ต้องแก้ `.env`)

ขับเว็บ — flow ตัวแทน: ลูกค้าทักทาง LINE → เปิด lead ใหม่ → อนุมัติร่างคำตอบของ AI:

```bash
LINE_CHANNEL_SECRET=$(cat /tmp/ai-crm-line-secret) pnpm -s line:simulate "สวัสดีครับ สนใจทำเว็บไซต์ร้านอาหาร 3 สาขา"
node .claude/skills/run-ai-crm/driver.mjs <<'EOF'
login
goto /leads?source=LINE
click text=ติดต่อผ่าน LINE — LINE e001
wait text=ร่างอัตโนมัติเมื่อลูกค้าทักเข้ามาทาง LINE
count text=รออนุมัติ — ยังไม่ถูกบันทึก
click role=button[name="อนุมัติและส่งทาง LINE"]
wait text=อนุมัติและส่งข้อความแล้ว
text ol li:has-text("ร่างโดย AI")
ss 02-line-lead
EOF
```

ได้ `count` = 3 (สรุป+คะแนน / งานถัดไป / ร่าง LINE), bubble "ส่งแล้ว · ร่างโดย AI" และภาพ `/tmp/ai-crm-shots/02-line-lead.png` — **เปิดดูภาพทุกครั้ง**

ฟอร์มสาธารณะ (ไม่ต้อง login):

```bash
node .claude/skills/run-ai-crm/driver.mjs <<'EOF'
goto /contact-us
fill #name :: คุณทดสอบ สกิล
fill #email :: skill.check@example.com
fill #message :: อยากทำระบบจองคิวออนไลน์
check input[type=checkbox]
click role=button[name="ส่งข้อมูล"]
wait text=ได้รับข้อมูลแล้ว
ss 03-contact-us
EOF
```

| คำสั่ง | ทำอะไร |
|---|---|
| `login [email]` | login (default `sales01@demo.local`, admin คือ `admin@demo.local`) |
| `goto <path>` | เปิด `BASE + path` แล้วรอ network idle |
| `click <selector>` / `check <selector>` / `wait <selector>` | Playwright selector (`text=…`, `role=button[name="…"]`, CSS) — เลือก**ตัวที่มองเห็น**ตัวแรก |
| `fill <selector> :: <text>` | กรอกช่อง (คั่นด้วย ` :: `) |
| `press <key>` | กดปุ่ม |
| `text <selector>` / `count <selector>` | พิมพ์ข้อความ (ย่อ) / จำนวนตัวที่มองเห็น |
| `api <METHOD> <path> [:: <json>]` | เรียก API ผ่านหน้าเว็บด้วย session cookie ของ browser → status + body |
| `eval <js>` | `page.evaluate` แล้วพิมพ์ JSON |
| `viewport <w> <h>` | เปลี่ยนขนาดจอ (มือถือ: `390 844`) |
| `ss <name>` | full-page screenshot → `$OUT/<name>.png` |

env: `BASE` (default `http://localhost:3000`), `OUT` (default `/tmp/ai-crm-shots`), `SEED_DEMO_PASSWORD` (default อ่านจาก `apps/api/.env`) — บรรทัดว่างและบรรทัดขึ้นต้น `#` ถูกข้าม, คำสั่งแรกที่ล้มหยุดสคริปต์และเก็บ `zz-failure.png`

LINE เพิ่มเติม: `pnpm line:simulate "…" --repeat 2` (event ซ้ำ → `duplicates: 1`), `--bad-signature` (→ 401, exit 1), `--user U…` (ผู้ใช้ LINE คนอื่น → lead ใหม่ชื่อ `ติดต่อผ่าน LINE — LINE <4 ตัวท้ายของ user id>`)

ปิด:

```bash
.claude/skills/run-ai-crm/stack.sh down     # ปิดทั้ง process group + ทุกตัวที่จับ 3000/4000 (Postgres ยังรัน — ปิดด้วย pnpm db:down)
.claude/skills/run-ai-crm/stack.sh status
```

## Direct invocation (งานที่แตะแค่ส่วนภายใน)

API ด้วย curl (session cookie ใน jar):

```bash
PW=$(sed -n 's/^SEED_DEMO_PASSWORD=//p' apps/api/.env)
curl -s -c /tmp/ai-crm-cookies.txt -H 'content-type: application/json' -d "{\"email\":\"sales01@demo.local\",\"password\":\"$PW\"}" http://localhost:4000/api/auth/login
curl -s -b /tmp/ai-crm-cookies.txt 'http://localhost:4000/api/leads?stage=PROPOSAL&limit=2'
```

AI skill ตรงๆ (ไม่ต้องเปิด stack) — ไฟล์ต้องเป็น `.mts`:

```bash
SKILL_DIR=$(git rev-parse --show-toplevel)/skills/crm-copilot
cat > /tmp/copilot-direct.mts <<EOF
import { runCrmCopilot } from '$SKILL_DIR/src/index.ts';
import { EVAL_CASES } from '$SKILL_DIR/evals/cases.ts';
const input = EVAL_CASES.find((c) => c.id === 'price-and-discount')!.input;
const result = await runCrmCopilot(input, { provider: null, timeoutMs: 1_000 });
console.log(result.source, result.fallbackReason, result.output.qualification.score, result.output.flags);
EOF
(cd "$SKILL_DIR" && pnpm exec tsx /tmp/copilot-direct.mts)   # → FALLBACK no_api_key 65 [ 'PRICE_REQUEST' ]
```

ใส่ provider จริงได้ด้วย `createClaudeProvider({ apiKey, model: 'claude-sonnet-5', effort: 'medium' })` จาก `src/index.ts` (ต้องมี key — ยังไม่ได้ลองในเครื่องนี้)

## Production image (CSP / header / build จริง)

```bash
JWT_SECRET=$(openssl rand -base64 48) LINE_CHANNEL_SECRET=$(cat /tmp/ai-crm-line-secret) docker compose -f docker-compose.prod.yml up --build -d
JWT_SECRET=x docker compose -f docker-compose.prod.yml run --rm -e SEED_DEMO_PASSWORD="$(sed -n 's/^SEED_DEMO_PASSWORD=//p' apps/api/.env)" -e ALLOW_PRODUCTION_SEED=true migrate pnpm --filter @ai-crm/api db:seed   # volume ใหม่เท่านั้น (มีข้อมูลแล้ว = "Database already has data…" exit 1)
for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:3100/login && break; perl -e 'select(undef,undef,undef,1)'; done   # รอ web พร้อม (macOS ไม่มี timeout)
LINE_CHANNEL_SECRET=$(cat /tmp/ai-crm-line-secret) pnpm -s line:simulate "ทดสอบบน production image" --url http://localhost:3100
BASE=http://localhost:3100 OUT=/tmp/ai-crm-shots/prod node .claude/skills/run-ai-crm/driver.mjs <<'EOF'
login
viewport 390 844
goto /leads?source=LINE
click text=ติดต่อผ่าน LINE — LINE e001
wait text=ทดสอบบน production image
ss 04-prod-line-lead-mobile
EOF
JWT_SECRET=x docker compose -f docker-compose.prod.yml stop
```

LINE webhook เข้าทางเว็บ (`:3100/api/webhooks/line` → rewrite → api) เหมือนบน Railway — `api` ของ compose ไม่เปิดพอร์ตออกนอก

## Test

```bash
pnpm test                                                              # 199 tests, ต้อง pnpm db:up ก่อน (ใช้ DB ai_crm_test)
pnpm exec vitest run --project api src/modules/line/webhook.test.ts     # ไฟล์เดียว
```

## Gotchas

- **หน้า list มีลิงก์ซ้ำที่มองไม่เห็น** — Leads render ทั้งตาราง (จอกว้าง) และการ์ดมือถือที่ถูกซ่อนด้วย CSS → `locator(...).first()` ได้ตัวที่ซ่อนแล้ว click ค้างจน timeout; driver เลือกเฉพาะตัวที่มองเห็น (`filter({ visible: true })`) ถ้าเขียน Playwright เองต้องทำแบบเดียวกัน
- **`pnpm line:simulate … | head -1` ไม่ส่งจริง** — `head` ปิด pipe แล้ว SIGPIPE ฆ่า process ก่อน POST (log ของ api ไม่มี `line webhook received`) → อย่า pipe เข้า `head` ใช้ `grep` แทน
- **webhook ตอบ 503** จนกว่า api จะได้ `LINE_CHANNEL_SECRET` ตอน start และ `line:simulate` ต้องใช้ secret ตัวเดียวกัน (ต่างกัน = 401) — เก็บไว้ในไฟล์เพราะแต่ละ shell ของ agent ไม่แชร์ env
- **header sticky โผล่กลางภาพ full-page** ถ้าหน้าเลื่อนอยู่ตอนถ่าย (เช่นหลัง click ปุ่มล่างหน้า) → `ss` เลื่อนขึ้นบนสุดก่อนถ่าย
- **`caret: 'initial'`** ตอน screenshot — ค่า default ของ Playwright แทรก style ซ่อน caret ก่อน React hydrate แล้ว React เตือน hydration mismatch (ไม่ใช่ bug ของแอป)
- ภาพจาก dev มีปุ่ม "N" ของ Next มุมซ้ายล่าง และ CSP ของ dev มี `unsafe-eval` → เรื่อง CSP / header ต้องตรวจบน production image (`:3100`)
- `tsx` รันไฟล์ `.ts` ที่อยู่นอก package `"type": "module"` (เช่นใน `/tmp`) เป็น CommonJS → top-level await ใช้ไม่ได้ → ใช้ `.mts`
- คำสั่ง `docker compose -f docker-compose.prod.yml` ทุกตัว (`logs`, `run`, `stop`) ต้องมี `JWT_SECRET` ตอนอ่านไฟล์ — ตัวที่ไม่ได้ start api ใส่ `x` ได้
- volume ของ Docker หายได้ (Docker reset) → DB ว่าง 0 ตาราง: `stack.sh up` ยังผ่าน health แต่ login ล้ม → รัน `pnpm db:deploy && pnpm db:seed`
- ไม่มี `ANTHROPIC_API_KEY` = การ์ด AI ขึ้น "Fallback" ทุกใบ (ตั้งใจ) — กติกาสำรองตรวจภาษาจากสัดส่วนตัวอักษร ข้อความไทยปนอังกฤษที่อังกฤษเยอะ (เช่น "ทดสอบบน production image") ได้ร่างภาษาอังกฤษ
- ข้อมูลที่ driver / simulate สร้างอยู่ใน DB dev ถาวร (lead "LINE e001" ถูกใช้ซ้ำ — ข้อความใหม่ต่อท้าย lead เดิมที่ยังเปิด)
- api test ห้ามส่ง Express app ให้ supertest ตรงๆ ต้องใช้ `await createTestApp(prisma)` (listen บน 127.0.0.1) — ไม่งั้นบน macOS ชนพอร์ตกับโปรแกรมอื่นแล้วล้มแบบสุ่ม

## Troubleshooting

- **`port 3000/4000 ถูกใช้อยู่`** จาก `stack.sh up`: มี `pnpm dev` ค้างจากรอบก่อน (เคยเจอตัวที่ไม่มี terminal ผูกอยู่หลายชั่วโมง) → `stack.sh down` (ฆ่าทุกตัวที่จับพอร์ต) แล้ว `up` ใหม่
- **`locator.click: Timeout 30000ms exceeded`** ทั้งที่เห็นข้อความในภาพ: selector ตรงกับ element ที่ถูกซ่อน / ถูกบัง — ใช้ driver นี้ (กรองตัวที่มองเห็นแล้ว) หรือ `count` ดูก่อน
- **`{"error":{"code":"INVALID_SIGNATURE"}}`** จาก `line:simulate`: secret ไม่ตรงกับที่ api ใช้อยู่ → เปิด stack ใหม่ด้วย secret จากไฟล์เดียวกัน
- **`{"error":{"code":"SERVICE_UNAVAILABLE"…}}`** จาก webhook: api start โดยไม่มี `LINE_CHANNEL_SECRET`
- **`Top-level await is currently not supported with the "cjs" output format`**: รัน `.ts` นอก package ESM → เปลี่ยนเป็น `.mts`
- **`error while interpolating services.api.environment.JWT_SECRET`**: คำสั่ง compose ของ production ไม่มี `JWT_SECRET` → ใส่ `JWT_SECRET=x` นำหน้า
- **`Invalid environment variables: DATABASE_URL … JWT_SECRET`**: รัน image ของ api โดยไม่ส่ง env (เช่น `docker run` ตรงๆ) — ใช้ compose
- **`Parse Error: Expected HTTP/, RTSP/ or ICE/`** ใน api test: supertest listen บน `::` แล้วไปชนพอร์ตของโปรแกรมอื่นบน `127.0.0.1` → ใช้ `createTestApp`
