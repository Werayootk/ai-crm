# AI CRM

AI CRM MVP สำหรับทีมขาย 20 คน (~2,000 contacts, 300 active leads) — website + API + Postgres + AI CRM skill + LINE OA

> อยู่ระหว่างพัฒนา: Phase 1–5 เสร็จแล้ว (foundation, auth + CRM API, web UI + ไฟล์ deploy, AI Copilot + approval flow, LINE OA) — ดูแผนและลำดับงานที่ [docs/plans/2026-09-13-mvp-plan.md](docs/plans/2026-09-13-mvp-plan.md)
> README ฉบับเต็ม (architecture, API notes, deploy, trade-offs) จะเขียนใน Phase 6

## Stack

Next.js 16 (`apps/web`) · Express 5 (`apps/api`) · Prisma 7 + PostgreSQL 17 · zod (`packages/shared`) · pnpm workspaces

## Quick start (local)

ต้องมี Node ≥ 22.12, pnpm 11 และ Docker

```bash
cp apps/api/.env.example apps/api/.env          # ตั้ง SEED_DEMO_PASSWORD (≥ 12 ตัวอักษร)
cp apps/web/.env.example apps/web/.env.local

pnpm install
pnpm db:up          # Postgres ใน Docker
pnpm db:generate    # Prisma Client
pnpm db:deploy      # apply migrations
pnpm db:seed        # ข้อมูลสังเคราะห์ทั้งหมด (ไม่มีข้อมูลลูกค้าจริง)
pnpm dev            # web http://localhost:3000 · api http://localhost:4000
```

เปิด http://localhost:3000 → login ด้วยบัญชี demo ที่ seed สร้าง: `admin@demo.local`, `sales01@demo.local` … `sales19@demo.local` — รหัสผ่านคือค่า `SEED_DEMO_PASSWORD`

หน้าที่มี: Leads (ค้นหา / กรอง / เรียง), Pipeline (board ตาม stage), รายละเอียด lead (ย้าย stage, timeline, บันทึกกิจกรรม, AI Copilot), Contacts, Companies — ใช้ได้ทั้งจอกว้างและมือถือ

API ลองเรียกได้จาก [apps/api/requests.http](apps/api/requests.http) ด้วย VS Code extension "REST Client"

### AI Copilot

หน้ารายละเอียด lead → **ขอคำแนะนำจาก AI** → ได้การ์ด "รออนุมัติ" 3 ใบ: สรุป + คะแนน, งานถัดไป, ร่างข้อความ LINE (เฉพาะ contact ที่ผูก LINE และมีข้อความที่ยังไม่ได้ตอบ) — แก้ไขได้ก่อนกดอนุมัติ ข้อมูลใน CRM เปลี่ยนหลังคนกดอนุมัติเท่านั้น และทุกการตัดสินใจลง timeline

- ไม่ใส่ `ANTHROPIC_API_KEY` ก็ใช้ได้: ระบบใช้กติกาสำรอง (rule-based) และติดป้าย "กติกาสำรอง" ให้เห็น
- ใช้ Claude: ใส่ `ANTHROPIC_API_KEY` ใน `apps/api/.env` (model ตั้งด้วย `AI_MODEL`, default `claude-sonnet-5`) แล้ว restart api — `GET /api/health` จะแสดง `"ai": "claude"`
- skill, guardrails และ eval cases: [skills/crm-copilot/SKILL.md](skills/crm-copilot/SKILL.md) · รัน eval: `pnpm --filter @ai-crm/crm-copilot eval`

### LINE OA

ลูกค้าทักเข้ามาทาง LINE → ระบบผูกกับ contact (สร้างใหม่ถ้ายังไม่มี) และ lead ที่ยังเปิดอยู่ (หรือสร้าง lead ใหม่ที่ยังไม่มีเจ้าของ) → ข้อความขึ้น timeline → AI ร่างคำตอบรออนุมัติ — ไม่มีข้อความออกไปหาลูกค้าจนกว่าคนจะกดอนุมัติหรือพิมพ์ตอบเอง

ทดลองในเครื่องโดยไม่ต้องมี LINE OA (โหมดจำลอง ข้อความขาออกไม่ถึงใคร):

```bash
# ใน apps/api/.env ใส่ LINE_CHANNEL_SECRET=<ค่าอะไรก็ได้ เช่น ผลของ openssl rand -hex 16> แล้ว restart pnpm dev
pnpm line:simulate "สวัสดีครับ สนใจทำเว็บไซต์ใหม่"        # ลูกค้าใหม่ทักมา → เปิดหน้า Leads กรองที่มา LINE
pnpm line:simulate "ข้อความเดิม" --repeat 2               # LINE ส่ง event ซ้ำ → บันทึกครั้งเดียว
pnpm line:simulate "ปลอม" --bad-signature                # ลายเซ็นผิด → 401 ไม่บันทึกอะไร
```

ใช้กับ LINE OA จริง: [docs/deploy-railway.md](docs/deploy-railway.md#line-oa) (webhook URL, channel secret / access token, QR สำหรับเพิ่มเพื่อน)

## Deploy

- Railway (Postgres + api + web): [docs/deploy-railway.md](docs/deploy-railway.md)
- ลอง production image ชุดเดียวกันในเครื่อง: `JWT_SECRET=$(openssl rand -base64 48) docker compose -f docker-compose.prod.yml up --build` → http://localhost:3100

## ตรวจคุณภาพ

```bash
pnpm lint
pnpm typecheck
pnpm test     # ใช้ DB ai_crm_test (ถูกล้างทุกครั้งที่รัน)
pnpm build
```

CI (GitHub Actions) รันชุดเดียวกันทุก push/PR — [.github/workflows/ci.yml](.github/workflows/ci.yml)
