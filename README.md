# AI CRM

AI CRM MVP สำหรับทีมขาย 20 คน (~2,000 contacts, 300 active leads) — website + API + Postgres + AI CRM skill + LINE OA

> อยู่ระหว่างพัฒนา: Phase 1 (foundation) เสร็จแล้ว — ดูแผนและลำดับงานที่ [docs/plans/2026-09-13-mvp-plan.md](docs/plans/2026-09-13-mvp-plan.md)
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

เปิด http://localhost:3000 จะเห็นสถานะ API / Database

บัญชี demo ที่ seed สร้าง: `admin@demo.local`, `sales01@demo.local` … `sales19@demo.local` — รหัสผ่านคือค่า `SEED_DEMO_PASSWORD` (หน้า login มาใน Phase 2–3)

## ตรวจคุณภาพ

```bash
pnpm lint
pnpm typecheck
pnpm test     # ใช้ DB ai_crm_test (ถูกล้างทุกครั้งที่รัน)
pnpm build
```

CI (GitHub Actions) รันชุดเดียวกันทุก push/PR — [.github/workflows/ci.yml](.github/workflows/ci.yml)
