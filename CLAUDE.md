# CLAUDE.md

คู่มือสำหรับ Claude Code ในโปรเจกต์ **ai-crm** — อ่านให้ครบก่อนเริ่มงานทุกครั้ง

> **สถานะปัจจุบัน:** Phase 1–4 เสร็จ (foundation, auth + CRM API, web UI + ไฟล์ deploy, AI Copilot + approval flow) — ขั้นตอน deploy บน Railway ต้องใช้บัญชีผู้ใช้ ดู [docs/deploy-railway.md](docs/deploy-railway.md) · ถัดไป Phase 5 (LINE OA)
> แผน: [docs/plans/2026-09-13-mvp-plan.md](docs/plans/2026-09-13-mvp-plan.md) · โจทย์: [docs/assignment.pdf](docs/assignment.pdf) (หน้า 1–3 JD, หน้า 4–5 โจทย์)

## คำสั่งที่ใช้บ่อย (รันที่ root)

```bash
pnpm install
pnpm db:up          # Postgres 17 ใน Docker (DB: ai_crm และ ai_crm_test)
pnpm db:generate    # generate Prisma Client → apps/api/src/generated/prisma (ต้องรันหลัง install และหลังแก้ schema)
pnpm db:deploy      # apply migrations ที่ยังไม่ได้ลง
pnpm db:migrate     # dev: สร้าง migration ใหม่จาก schema + apply + generate
pnpm db:seed        # ข้อมูลสังเคราะห์ — DB ที่มีข้อมูลแล้วต้องใช้ `pnpm db:seed -- --reset` (ล้างข้อมูลเดิมทั้งหมด)
pnpm dev            # web http://localhost:3000 + api http://localhost:4000
pnpm test           # vitest (shared, crm-copilot, api กับ DB ai_crm_test, web)
pnpm lint && pnpm typecheck && pnpm build
pnpm --filter @ai-crm/crm-copilot eval   # eval 7 เคสของ skill (ใช้ Claude ถ้ามี ANTHROPIC_API_KEY ใน apps/api/.env ไม่งั้นทดสอบกติกาสำรอง)

# production image ทั้งชุดในเครื่อง (จำลอง Railway) — web ที่ http://localhost:3100
JWT_SECRET=$(openssl rand -base64 48) docker compose -f docker-compose.prod.yml up --build
```

env: คัดลอก `apps/api/.env.example` → `apps/api/.env` และ `apps/web/.env.example` → `apps/web/.env.local`
ลองเรียก API ด้วยมือ: [apps/api/requests.http](apps/api/requests.http) (VS Code REST Client — อ่านรหัสผ่านจาก `.env`)

## แนวทางเขียนเว็บ (ใช้ตั้งแต่ Phase 3)

- อ่านเอกสาร Next.js 16 ใน `node_modules/next/dist/docs/` ก่อนเขียน — เช่น `middleware.ts` เปลี่ยนเป็น `src/proxy.ts`, `params` ของ page เป็น Promise (`PageProps<'/leads/[id]'>`)
- เรียก API ผ่าน `api` ใน `apps/web/src/lib/endpoints.ts` เท่านั้น — response ทุกตัวถูก parse ด้วย schema ของ shared (ไม่เชื่อข้อมูลจาก network)
- ฟอร์ม: validate ด้วย schema ของ shared (`validate()` ใน `lib/form.ts`) ก่อนส่ง และแสดง `issues` จาก API ใต้ field ด้วย path เดียวกัน — ข้อความ error ของ zod เป็นภาษาไทย (`z.config(th())`)
- ข้อมูลฝั่ง client ใช้ TanStack Query (`lib/queries.ts`); หลังแก้ lead เรียก `useInvalidateLeads()`; 401 ทุกที่ถูกพาไปหน้า login พร้อม `?next=` (ตรวจด้วย `safeNextPath` กัน open redirect)
- filter ของหน้ารายการเก็บใน URL (refresh / แชร์ลิงก์ได้); หน้าที่ใช้ `useSearchParams` ต้องห่อด้วย `<Suspense>`
- UI component เขียนเองบน element ของ browser (`<dialog>`, `<select>`) ใน `components/ui.tsx` — ไม่มี tailwind-merge จึงห้าม override ขนาด/ความกว้างด้วย className ให้เพิ่ม prop (เช่น `compact`) แทน
- ตรวจ UI ใน browser จริงก่อนบอกว่าเสร็จ (Phase 3 ใช้ `playwright-core` + Chrome ในเครื่อง — ดู log #6)

## แนวทางเขียน API (ใช้ตั้งแต่ Phase 2)

- ทุก endpoint ห่อด้วย `route({ auth, params?, query?, body? }, handler)` จาก `apps/api/src/http/route.ts` — ต้องประกาศ `auth: 'public' | 'user' | 'admin'` เสมอ และ zod validate ก่อนเข้า handler
- schema ของ request/response อยู่ใน `packages/shared/src/schemas/` (web ใช้ตัวเดียวกัน) — API แปลง Prisma row เป็น DTO ผ่าน `select` + mapper ใน `apps/api/src/modules/mappers.ts` เท่านั้น ห้ามส่ง row ของ Prisma ออกไปตรงๆ
- error: โยน `HttpError` / `validationError` / `notFound` จาก `http/errors.ts`; error ของ Prisma ที่มีความหมายเฉพาะใช้ `withPrismaErrors` แปลงเป็น 409/404
- กันการเขียนทับกัน: ใช้ `updateMany({ where: { id, <สถานะเดิม> } })` แล้วเช็ค `count` (เช่น stage change) — approve AI suggestion ใน Phase 4 ใช้แบบเดียวกัน
- `$transaction` เก็บแค่การเขียนที่ต้อง atomic แล้วอ่านข้อมูลที่จะตอบกลับหลัง commit (อ่าน relation ซ้อนใน transaction ทำให้ `pg` เตือนและจะพังใน pg@9)
- event สำคัญทางธุรกิจ log ด้วย `req.log.info({ ...ids }, 'message')`; activity ประเภท STAGE_CHANGE / SYSTEM / AI_* ระบบสร้างเท่านั้น
- test: supertest + DB `ai_crm_test`, ใช้ `await createTestApp(prisma)`, `createUser`, `loginAs` ใน `apps/api/test/helpers.ts` และ fixture ใน `apps/api/test/fixtures.ts` — ห้ามส่ง Express app ให้ supertest ตรงๆ (มันจะ listen บน `::` ซึ่งบน macOS ชนพอร์ตกับโปรแกรมอื่นแล้วล้มแบบสุ่ม — `createTestApp` listen บน `127.0.0.1` ให้แล้ว)

## แนวทางฝั่ง AI (ใช้ตั้งแต่ Phase 4)

- `skills/crm-copilot` เป็น pure package: รับ `CopilotInput` คืน `CopilotResult` — ห้าม import Prisma/Express/LINE ในนั้น; เรียก Claude ผ่าน `@anthropic-ai/sdk` `messages.parse()` + `zodOutputFormat(copilotOutputSchema)` เท่านั้น
- `runCrmCopilot` ไม่ throw (ยกเว้น input ผิด shape): ไม่มี key / timeout / API error / refusal / output ไม่ผ่าน schema → กติกาสำรอง (`source: 'FALLBACK'` + `fallbackReason`) และทุก output ผ่าน `applyGuardrails` เสมอ
- แก้ prompt หรือ guardrail แล้วต้องเพิ่ม `PROMPT_VERSION` และรัน `pnpm --filter @ai-crm/crm-copilot eval` — เคสใหม่เพิ่มใน `evals/cases.ts` และตาราง eval ใน `SKILL.md`
- ข้อมูลที่ส่งให้ AI สร้างใน `apps/api/src/modules/ai/context.ts` เท่านั้น — ห้ามส่ง email/phone/lineUserId
- output ของ AI ลงตาราง `AiSuggestion` สถานะ PENDING เท่านั้น; การเขียนจริงอยู่ใน `approveSuggestion` (claim ด้วย `updateMany` → side effect + activity `AI_APPROVED` ใน transaction เดียว → ส่ง LINE หลัง commit) และ field ที่แก้ได้ต่อ type กำหนดใน `APPROVE_FIELDS` ของ shared
- env: `ANTHROPIC_API_KEY` (ว่าง = กติกาสำรอง), `AI_MODEL` (default `claude-sonnet-5`), `AI_EFFORT`, `AI_TIMEOUT_MS`, `LINE_MODE` — `/api/health` บอกโหมด `ai: claude|fallback`, `line: live|mock`

## ข้อควรรู้ของ stack (ตรวจแล้วตอน Phase 1)

- **Prisma 7.10**: connection URL อยู่ใน `apps/api/prisma.config.ts` (ไม่ใช่ใน schema), client import จาก `src/generated/prisma/client` และต้องใช้ `@prisma/adapter-pg`; `migrate dev` ไม่ generate/seed ให้อัตโนมัติ
- **ห้ามรัน `prisma migrate reset` / `db push --force-reset` / `--accept-data-loss` เอง** — Prisma บล็อก AI agent และต้องได้ความยินยอมจากผู้ใช้ก่อน ห้ามหาทางเลี่ยง
- CHECK constraints เขียนเป็น raw SQL ท้าย migration `init`; partial unique index ของ `AiSuggestion` อยู่ใน schema (preview `partialIndexes`)
- enum ใน `packages/shared/src/enums.ts` ต้องตรงกับ Prisma schema — `apps/api/src/db.test.ts` ตรวจให้
- `packages/shared` export เป็น TypeScript source: api bundle ด้วย tsup (`noExternal`), web ใช้ `transpilePackages`
- test ใช้ DB ที่ชื่อลงท้าย `_test` เท่านั้น (ถูกล้างทุกครั้งที่รัน)
- **Next.js 16**: อ่านเอกสารใน `node_modules/next/dist/docs/` ก่อนเขียนโค้ดฝั่ง web (ดู `apps/web/AGENTS.md` ที่ Next สร้าง) — API ต่างจากเวอร์ชันเก่า
- version ที่ pin ไว้โดยตั้งใจ: TypeScript 6.0 (typescript-eslint ยังไม่รองรับ 7), Prisma 7.10 (8.0 ยังเป็น RC), zod 4.6.2 (ผ่านเกณฑ์ minimum release age ของ pnpm); pnpm อนุญาต install script แค่ใน `allowBuilds`

---

## 1. สรุปโจทย์

Test assignment ตำแหน่ง **Lead AI Software Engineer** ของ Jenosize: สร้าง **AI CRM MVP ที่ใช้งานได้จริง** (เป็นงานเขียนโค้ด ไม่ใช่แค่ architecture proposal) ที่เชื่อม website + API + database + reusable AI skill + LINE Official Account เข้าด้วยกัน พร้อมแสดงวิจารณญาณระดับ lead ด้าน security, testing, deployment และ handover

### Scenario

- CRM ภายในสำหรับทีมขาย **20 คน**, ประมาณ **2,000 contacts** และ **300 active leads**
- Lead เข้ามา 3 ช่องทาง: website, manual entry, LINE OA (ปัจจุบันข้อมูลกระจายอยู่ใน chat, spreadsheet และโน้ตส่วนตัว)
- Salesperson ต้องทำได้:
  - ดู lead profile และ timeline
  - ย้าย stage: `New → Qualified → Proposal → Won | Lost`
  - ขอให้ AI สรุป lead, ให้คะแนน (score) และแนะนำ next-best action
  - ส่งหรือ approve LINE reply โดยที่ audit trail ไม่หาย

### ข้อกำหนดที่ต้องยึด

- ใช้ **synthetic data เท่านั้น** และใช้ LINE OA test account ของเราเอง
- เลือก AI provider ได้อิสระ (ยังไม่ได้เลือก) แต่ต้องมี **safe fallback** เมื่อ AI model หรือ LINE service ใช้งานไม่ได้
- **Timebox:** 5 วันทำการ แนะนำไม่เกิน 16 ชั่วโมงโฟกัส — ถ้าทำไม่เสร็จ ให้ส่ง working slice พร้อมเอกสาร priority และ trade-off
- ไม่ต้อง production-complete: ผู้ประเมินดู vertical slice ที่ต่อกันครบ, trade-off ที่สมเหตุสมผล, โค้ดอ่านง่าย และหลักฐานว่าใช้ AI coding tools **โดยมี human review**

### เกณฑ์ให้คะแนน 3 ส่วน

#### Part 1 — Working AI CRM Product (50%)
วัด: Result Oriented (R) + Ownership (O)

- Responsive website: login หรือ demo auth ที่มีเอกสารอธิบาย, จัดการ lead / company / contact, อัปเดต pipeline stage, search/filter, หน้า lead detail ที่มี activity และ conversation timeline
- API + relational database ครอบคลุม **Users, Companies, Contacts, Leads/Deals, Activities, Messages** พร้อม schema, migrations, synthetic seed data, validation และ constraints ที่มีความหมาย
- Deploy demo ที่ใช้งานได้จริง — core flow ต้องรอดหลัง refresh/restart และห้ามพึ่ง hard-coded in-memory data

#### Part 2 — AI CRM Skill + LINE OA Integration (30%)
วัด: Growth & Agile (G) + Think Like Entrepreneur + Spot Opportunities

- `skills/crm-copilot/SKILL.md` ระบุ purpose, inputs, outputs, allowed actions, guardrails, failure behavior และ **evaluation cases อย่างน้อย 5 ข้อ**
- ใช้ CRM context สร้าง lead summary, qualification score พร้อมเหตุผล, next-best action และ draft LINE reply — **ต้องแยก AI suggestion ออกจาก DB write หรือ outbound message ที่ยืนยันแล้ว**
- LINE OA: verify webhook signature, รับ inbound message, map LINE user → CRM contact/lead, persist event, ส่ง reply หรือ approval-based draft, มี retry/idempotency และมี mock adapter สำหรับ local test

#### Part 3 — Lead-Level Engineering Evidence & Handover (20%)
วัด: Win Together (W) + Leave Legacy

- README: ขั้นตอน setup/run/deploy, architecture + data-flow diagram, API notes, `.env.example`, key trade-offs, known limitations, production next steps
- Automated tests อย่างน้อย: (1) core CRM flow (2) AI skill behavior/fallback (3) LINE webhook security/idempotency
- Structured logging และ monitoring notes
- AI-usage log สั้นๆ: ตัวอย่าง task/prompt, สิ่งที่ review หรือ reject และการเปลี่ยนแปลงสำคัญ 1 อย่างที่เกิดจาก human inspection
- สิ่งที่ต้องส่ง: source repo ที่เข้าถึงได้, deployed URL + demo credentials, วิธีทดสอบ LINE OA หรือ QR code, วิดีโอ walkthrough 3–5 นาที — **ห้ามส่ง live secret**

### Red flags จาก JD ที่ต้องหลีกเลี่ยง

- ใช้ AI แบบไม่ review, ไม่มี test หรือไม่คำนึงถึง security
- Over-engineer งานเล็ก หรือ under-engineer ส่วนที่ critical
- เจอ requirement คลุมเครือแล้วหยุดรอ — ให้จด assumption ไว้แล้วเดินงานต่อ

---

## 2. Tech Stack (บังคับ)

| Layer | Tech |
|---|---|
| Frontend | Next.js + TypeScript |
| Backend | Express + TypeScript |
| Database | PostgreSQL + Prisma (schema + migrations) |
| Validation | zod |

ห้ามเปลี่ยนหรือเพิ่ม framework หลักนอกเหนือจากนี้โดยไม่ถามก่อน

---

## 3. โครงสร้าง Monorepo

```
apps/
  web/        Next.js frontend — อ่าน/แก้ข้อมูลผ่าน apps/api เท่านั้น
  api/        Express backend — REST API, Prisma, LINE webhook, เรียก AI skill
packages/
  shared/     zod schemas + TypeScript types + กติกา business ที่ใช้ร่วมกัน (เช่น stage transition)
skills/
  crm-copilot/  workspace package: SKILL.md + prompt + runtime (Claude/mock provider, guardrails, กติกาสำรอง) + evals — depend แค่ shared ห้าม depend on Prisma
docker/       init script ของ Postgres สำหรับ local
docs/         โจทย์ แผน (docs/plans/) และ AI-usage log
```

- `apps/api` เป็นที่เดียวที่เข้าถึง database (ผ่าน Prisma) — `apps/web` ห้ามต่อ DB เอง
- Type ที่ใช้ข้ามแอปให้ derive จาก zod schema ใน `packages/shared` (`z.infer`) ห้ามประกาศ type ซ้ำสองที่

---

## 4. กติกาการเขียนโค้ด

- **TypeScript strict** ทุก package — ห้ามปิด strict และห้ามใช้ `@ts-ignore` เพื่อหลบ error
- **ห้ามใช้ `any`** ทั้งแบบประกาศเองและ `as any` — ข้อมูลที่ไม่รู้ type ให้ใช้ `unknown` แล้ว narrow หรือ parse ด้วย zod
- **zod validate ทุก endpoint** — body, params และ query ของทุก route ต้องผ่าน zod schema ก่อนเข้า business logic ใช้หลักเดียวกันกับ LINE webhook payload, output จาก AI model และ environment variables ตอน start
- **ห้าม hardcode secret** — API key, LINE channel secret / access token, `DATABASE_URL`, session secret ต้องอ่านจาก env เท่านั้น เพิ่ม env key ใหม่เมื่อไร ต้องเพิ่มใน `.env.example` (ใส่ค่า placeholder) ด้วย และห้าม log secret
- **ทุก business logic ต้องมี test** — เช่น stage transition, การ map LINE user → contact/lead, approval flow, webhook signature + idempotency, AI fallback
  - แยก business logic ออกจาก Express handler เพื่อให้ test ได้ตรงๆ
  - test ต้องใช้ mock adapter ของ LINE และ AI — ห้ามเรียก service จริงใน test

---

## 5. ข้อห้ามเด็ดขาด

1. **ห้าม commit `.env`** หรือไฟล์ใดที่มี secret จริง (รวมถึง seed, test fixture และ docs)
   - `.gitignore` กัน `.env` และ `.env.*` ไว้แล้ว ยกเว้น `.env.example` — ห้ามแก้ส่วนนี้ให้หลวมลง
   - ก่อน commit ให้ตรวจ diff ทุกครั้งว่าไม่มี token/key หลุด
2. **ห้ามให้ AI เขียน DB โดยตรง — ต้องผ่าน approval flow เสมอ**
   - AI layer (LLM call / crm-copilot skill) ไม่มีสิทธิ์เรียก Prisma หรือส่ง LINE เอง: รับ CRM context เข้า → คืน structured output ที่ผ่าน zod ออกไป
   - ระบบบันทึก output นั้นเป็น suggestion/draft สถานะ "รออนุมัติ" เท่านั้น — การเปลี่ยนข้อมูล CRM จริง (stage, score, lead/contact) และการส่ง LINE reply ที่ AI ร่าง ทำได้หลังผู้ใช้ approve แล้วเท่านั้น
   - ทุกการ approve/reject ต้องลง audit trail: ใคร, เมื่อไร, เปลี่ยนอะไร, มาจาก suggestion ไหน
   - เมื่อ AI ล่ม / timeout / output ไม่ผ่าน zod ต้อง fallback อย่างปลอดภัย และ fallback ต้องไม่ข้าม approval flow

---

## 6. เอกสารการทำงาน

- **แผน** เก็บที่ `docs/plans/YYYY-MM-DD-<หัวข้อ>.md` โดยใส่วันที่และสถานะ (Draft / Approved) ไว้ที่หัวไฟล์ — ห้ามเริ่มโค้ดของ phase ใดจนกว่าผู้ใช้จะสั่ง
- **Git**: แต่ละ phase อยู่บน branch ของตัวเอง (`phase-<n>-<หัวข้อ>` แตกต่อจาก phase ก่อนหน้า) และ commit เมื่อผู้ใช้อนุมัติเท่านั้น — ไม่ commit ตรงเข้า `main`, ไม่ push เอง, ไม่ commit `docs/assignment.pdf`
- **AI-usage log** — ทุก session ที่ใช้ AI ต้องต่อท้าย [docs/ai-usage-log.md](docs/ai-usage-log.md): วันเวลา (UTC+07:00 ดึงจาก transcript หรือเวลาไฟล์ ห้ามเดา), prompt ต้นฉบับ, สิ่งที่ AI ทำ, ผลลัพธ์, สิ่งที่คน review/reject และอัปเดตตาราง "Review / Reject" ท้ายไฟล์
