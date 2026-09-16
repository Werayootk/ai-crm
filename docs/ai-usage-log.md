# AI Usage Log

บันทึกการใช้ AI coding tools ในโปรเจกต์นี้ — เป็น deliverable ของ Part 3 ("short AI-usage log: sample tasks/prompts, what you reviewed/rejected, and one meaningful change after human inspection")

- **เครื่องมือ:** Claude Code (VS Code extension), model Claude Opus 5 (1M context)
- **เวลา:** เวลาไทย (UTC+07:00) ดึงจาก timestamp ใน transcript ของ session และเวลาแก้ไขไฟล์ ไม่ได้ประมาณเอา
- **กติกา:** ทุก session ที่ใช้ AI ต้องเพิ่ม entry ต่อท้าย และอัปเดตตาราง "Review / Reject / การเปลี่ยนแปลงหลัง human inspection" ท้ายไฟล์

รูปแบบของแต่ละ entry: วันเวลา · prompt ต้นฉบับ · สิ่งที่ AI ทำ · ผลลัพธ์ · สิ่งที่คน review หรือตัดสินใจ

## สรุปสั้น (สำหรับผู้ประเมิน)

- **ตัวอย่าง task / prompt**: อ่านโจทย์แล้วเขียนกติกา repo (#1), วางแผน schema / endpoint / 6 phase ใน plan mode (#2), "commit Phase 3 … ทำ Phase 4 - จบ … เขียน step deploy" (#8)
- **สิ่งที่คน review / reject**: reject การเริ่มโค้ดทันทีหลังวางแผน (19:17), เปลี่ยน model จาก `claude-opus-5` ที่ AI เสนอเป็น `claude-sonnet-5` (19:33), เลือกให้ commit ทีละ phase บน branch ของตัวเอง (22:13) — ตารางท้ายไฟล์
- **การเปลี่ยนแปลงสำคัญจาก human inspection**: การ reject ตอน 19:17 เปลี่ยนวิธีทำงานทั้งโปรเจกต์ — แผนต้องเก็บใน `docs/plans/` ก่อนเขียนโค้ด, ทุก session ต้องบันทึก log นี้ด้วยเวลาจริง และทุก phase ต้องบันทึก "สิ่งที่ต่างจากแผน" → ผู้ประเมินตรวจย้อนได้ว่าอะไรเปลี่ยนเพราะอะไร
- **AI ตรวจงานตัวเองอย่างไร** (ไม่ได้แทน human review): อ่านซอร์ส / สเปกทางการของ SDK และ LINE ก่อนเขียน, ตรวจทุกหน้าใน Chrome จริง (เจอ bug ที่ test ไม่จับหลายจุด เช่น logout redirect ซ้อน, ลำดับ timeline ของ LINE), หาต้นเหตุ test ล้มแบบสุ่มจนเจอเรื่องพอร์ตชนบน macOS แทนการใส่ retry, mutation test ยืนยันว่า test ความปลอดภัยจับ bug ได้จริง
- **ยังรอ**: PR #1 (Phase 1–6 + เอกสารส่งมอบ) merge เข้า `main` แล้ว 2026-09-14 — เหลือ deploy บน Railway / ตั้งค่า LINE OA จริง / อัดวิดีโอ ด้วยบัญชีของผู้ใช้

---

## Session 1 — 2026-09-13

### #1 · 18:47 — อ่านโจทย์และสร้าง CLAUDE.md

**Prompt**

> อ่าน docs/assignment.pdf ทั้งไฟล์
>
> แล้วสร้าง CLAUDE.md ที่บันทึก:
> - สรุปโจทย์และเกณฑ์ให้คะแนน 3 ส่วน
> - tech stack ที่บังคับ: Next.js/TypeScript (frontend), Express/TypeScript (backend), Prisma + Postgres
> - โครงสร้าง monorepo: apps/web, apps/api, packages/shared, skills/
> - กติกาการเขียนโค้ด: TypeScript strict, zod validate ทุก endpoint, ห้าม any, ห้าม hardcode secret, ทุก business logic ต้องมี test
> - ข้อห้ามเด็ดขาด: ห้าม commit .env, ห้ามให้ AI เขียน DB โดยตรง ต้องผ่าน approval flow เสมอ
>
> ยังไม่ต้องเขียนโค้ดอะไรทั้งสิ้น

**สิ่งที่ AI ทำ**

- อ่าน `docs/assignment.pdf` ครบ 5 หน้า (หน้า 1–3 เป็น JD, หน้า 4–5 เป็นโจทย์) และอ่าน `.gitignore`, `README.md`
- พบว่า `CLAUDE.md` มีอยู่แล้วแต่ว่าง → เขียนใหม่ทั้งไฟล์ (เสร็จ 18:51)

**ผลลัพธ์** — `CLAUDE.md` 5 ส่วน: สรุปโจทย์ + เกณฑ์ 3 Part, tech stack, โครงสร้าง monorepo, กติกาการเขียนโค้ด, ข้อห้ามเด็ดขาด

**สิ่งที่ AI เพิ่มเองนอกคำสั่ง** (แจ้งผู้ใช้ในคำตอบแล้ว และลบออกได้)

- approval flow ครอบคลุม LINE reply ที่ AI ร่างด้วย ไม่ใช่แค่การเขียน DB (อิงโจทย์ Part 2)
- ทุก approve/reject ต้องลง audit trail และ fallback ต้องไม่ข้าม approval flow
- `apps/web` ห้ามต่อ DB เอง ต้องผ่าน `apps/api`
- zod ครอบคลุม LINE webhook payload, output ของ AI และ env vars ด้วย
- ส่วน "Red flags จาก JD"

**Human review** — ผู้ใช้ไม่ได้ขอแก้ `CLAUDE.md` แล้วไปขั้นถัดไป

---

### #2 · 18:57 — Plan mode: Prisma schema, API endpoints, 6 phases

**Prompt**

> เข้า plan mode
>
> จากโจทย์ใน CLAUDE.md ช่วยเสนอ:
> 1. Prisma schema ครบทุก model รวม AiSuggestion และ WebhookEvent พร้อมเหตุผลว่าทำไมต้องมีสองตัวนี้
> 2. รายการ API endpoint ทั้งหมดพร้อม method/path/purpose
> 3. ลำดับการทำงาน 6 phase ที่แต่ละ phase จบแล้วรันได้จริง
>
> ขอเป็นแผน ยังไม่ต้องเขียนไฟล์

**สิ่งที่ AI ทำ**

- เข้า plan mode; repo ยังไม่มีโค้ดจึงไม่ได้ส่ง agent ไป explore
- 19:02 โหลด reference ของ Claude API เพื่อยืนยันวิธีใช้ SDK จากเอกสาร แทนการเดาจากความจำ — ได้ `client.messages.parse()` + `zodOutputFormat()` สำหรับ structured output, model id `claude-opus-5` และข้อควรตรวจ `stop_reason` (`refusal` / `max_tokens`)
- 19:12 เขียนแผนลงไฟล์ plan ของ Claude Code

**ผลลัพธ์** — แผน (ปัจจุบันอยู่ที่ `docs/plans/2026-09-13-mvp-plan.md`):

- Prisma schema 8 models (User, Company, Contact, Lead, Activity, Message, AiSuggestion, WebhookEvent) พร้อม constraint ที่ต้องเขียนเป็น raw SQL และเหตุผลว่าทำไมต้องมี AiSuggestion กับ WebhookEvent
- API 34 endpoints พร้อม flow ของ approve, LINE webhook และ AI fallback
- 6 phases (~16 ชม.) ที่จบแต่ละ phase แล้วรันได้ พร้อมลำดับการตัดงานถ้าเวลาไม่พอ

**การตัดสินใจหลักที่ AI เสนอ** (รอ review)

- `skills/crm-copilot` เป็น package ที่ไม่มี Prisma → บังคับกฎ "AI ห้ามเขียน DB" ด้วยโครงสร้าง
- Auth ใช้ JWT ใน httpOnly cookie + Next.js rewrites; LINE ใช้ Push API + `X-Line-Retry-Key`; deploy บน Railway
- ไม่มีตาราง AuditLog แยก (ใช้ Activity + AiSuggestion + Message แทน)

**จุดที่ AI ไม่แน่ใจและระบุไว้ในแผน**

- config ของ Prisma 7 (connection URL ย้ายไป `prisma.config.ts`) → ต้องตรวจตอน pin version
- Prisma ไม่รู้จัก partial unique index → migration ที่ generate ใหม่อาจ `DROP INDEX` ทิ้ง ต้องตรวจทุกครั้ง

**Human review** — ดู #3

---

### #3 · 19:17 — ผู้ใช้ reject การออกจาก plan mode

**Prompt** (ข้อความที่แนบมาตอน reject)

> เก็บเป็น Plan ต่อไป กับพวก Plan ให้บันทึกไว้ docs กับ log ที่เราคุยกันตั้งแต่แรกให้บันทึก docs/ai-usage-log.md ระบุวันที่ เวลา รายละเอียดที่เราคุยกัน

**สิ่งที่ AI ทำ**

- ดึงเวลาจริงของแต่ละ prompt จาก transcript ของ session และเวลาแก้ไขไฟล์ (ไม่ได้เดา)
- ปรับแผนให้ขั้นถัดไปคือเขียนเฉพาะเอกสาร ไม่เริ่มโค้ด → ผู้ใช้อนุมัติ
- 19:22–19:24 เขียน `docs/plans/2026-09-13-mvp-plan.md`, ไฟล์นี้ และหัวข้อ "เอกสารการทำงาน" ใน `CLAUDE.md` (ไม่ได้เขียนโค้ดและไม่ได้ commit)

**Human review** — ผู้ใช้เปลี่ยนทิศทางจาก "พร้อมเริ่ม implement" เป็น "บันทึกแผนและ log ก่อน"

---

### #4 · 19:33 — ผู้ใช้ตัดสินใจ 3 เรื่อง + สั่งเริ่ม Phase 1

**Prompt**

> ตัดสินใจใช้ deploy บน Railway, auth แบบ JWT cookie และใช้ model Claude Sonnet 5
> เริ่ม Phase 1 ได้

**สิ่งที่ AI ทำ**

- บันทึกการตัดสินใจลงแผน (สถานะ → Approved) และเปลี่ยน model จาก `claude-opus-5` ที่ AI เสนอเป็น `claude-sonnet-5`
- 19:35 ตรวจเครื่องก่อนเขียนโค้ด: Node 22.22, pnpm 11.20, Docker 29.7 (daemon ทำงาน), port 3000/4000/5432 ว่าง
- ตรวจ version จริงบน npm แทนการเดา แล้วพบ 3 เรื่องที่ทำให้ต้องปรับจากแผน:
  - `prisma` dist-tag `latest` ชี้ไปที่ `8.0.0-rc.14` (ยังเป็น RC) → pin `7.10.0` ให้ตรงกับ `@prisma/client`
  - TypeScript `latest` เป็น 7.0 (native compiler) แต่ typescript-eslint 8.70 รองรับแค่ `<6.1.0` → ใช้ TypeScript 6.0.3
  - เครื่องนี้เป็น Node 22 ไม่ใช่ 24 ตามแผน → ตั้ง engines เป็น Node ≥ 22.12 (ตรงกับ Prisma 7 และ Vitest 5)

**Phase 1 — สิ่งที่ AI ทำ (19:35–20:15)**

- ตรวจ config ของ Prisma 7.10 จากของจริงแทนการเดา: รัน `prisma init` ใน scratchpad และอ่าน reference ที่มากับ package → connection URL ต้องอยู่ใน `prisma.config.ts`, ใช้ generator `prisma-client` + driver adapter `@prisma/adapter-pg`
- พบว่า Prisma 7.10 มี preview `partialIndexes` → ทดสอบ syntax 3 แบบด้วย `prisma migrate diff` แล้วใช้แบบที่ generate SQL ถูกต้อง ทำให้ประกาศ partial unique index ใน schema ได้ ไม่ต้องใช้ raw SQL
- 20:03 สร้าง migration `init` ด้วย `--create-only` → เพิ่ม CHECK constraints 4 ตัว → apply → รัน `migrate dev --create-only` อีกรอบเพื่อตรวจ drift ได้ migration ว่าง (ไม่มี drift) แล้วลบทิ้ง
- Seed ข้อมูลสังเคราะห์: 20 users, 150 companies, 2,000 contacts, 450 leads, 2,041 activities, 577 messages (ใช้เวลา ~3 วินาที, ผ่าน CHECK ทุกตัว)
- สร้าง monorepo, `packages/shared` (enums + กติกา stage transition + zod), `apps/api` (env validation, pino, error format, `/api/health`), `apps/web` (Next.js + proxy `/api/*`), CI workflow
- ผลการตรวจ: test 46/46 ผ่าน, lint ผ่าน, typecheck ผ่านทั้ง 3 package, build ผ่าน, รัน production bundle แล้ว `/api/health` ได้ 200, `pnpm dev` เรียกผ่าน proxy ของ Next ได้ 200

**การตัดสินใจด้าน security ระหว่างทำ**

- ไม่ใช้ `zod@4.6.4` ที่ pnpm ต้องยกเว้นให้ (publish มาไม่ถึง 24 ชม.) → pin `4.6.2` ที่ผ่านเกณฑ์ minimum release age แล้วลบข้อยกเว้นออก
- อนุญาต install script แค่ `prisma`, `@prisma/engines`, `esbuild`
- Prisma บล็อก `migrate reset` เมื่อ AI agent เป็นคนรัน (ต้องให้ผู้ใช้ยินยอม) → **ไม่เลี่ยง** แต่ออกแบบ test ให้ใช้ `migrate deploy` + TRUNCATE กับ DB ที่ชื่อต้องลงท้าย `_test` แทน
- seed ไม่ยอมล้าง DB ที่มีข้อมูลอยู่แล้วถ้าไม่ระบุ `--reset`; รหัสผ่าน demo สุ่มใหม่ลง `apps/api/.env` (ไม่ commit)

**สิ่งที่ตรวจเจอและแก้**

- test `x-request-id` ที่ AI เขียนเองผิด: ใส่ newline ใน header ซึ่ง HTTP client ปฏิเสธตั้งแต่ก่อนส่ง → เปลี่ยนเป็นค่าที่ถูกต้องตาม HTTP แต่ไม่ผ่าน pattern ของเรา
- ESLint จับ `async rewrites()` ที่ไม่มี `await` ใน `next.config.ts` → เปลี่ยนเป็นคืน `Promise.resolve(...)`
- seed รอบแรกมี logic ที่อ่านยาก (`stagePath`, `stageTimes`) → เขียนใหม่ และทำให้ lead จาก LINE ที่ยังไม่มี owner มีแต่ข้อความขาเข้า (ใช้ demo การร่างคำตอบด้วย AI ใน Phase 4)
- Next.js 16 สร้าง `apps/web/AGENTS.md` + `apps/web/CLAUDE.md` เองตอน `next dev` → อ่านแล้ว เนื้อหาคือให้ agent อ่านเอกสาร Next ใน `node_modules` ก่อนเขียนโค้ด จึงเก็บไว้
- นอกแผน: เพิ่ม CHECK `Lead_closed_at_matches_stage` (บันทึกไว้ในแผนแล้ว)

**Human review** — ผู้ใช้เปลี่ยน model ที่ AI เสนอ (ดูตารางด้านล่าง); ผลงาน Phase 1 ยังรอผู้ใช้ review

---

### #5 · 20:22 — commit Phase 1 และเริ่ม Phase 2

**Prompt**

> commit phase 1 ได้ แล้วเริ่ม Phase 2

**สิ่งที่ AI ทำก่อน commit**

- repo อยู่บน `main` → แยก branch `phase-1-foundation` ก่อน commit (กติกาของ AI: ไม่ commit ตรงเข้า default branch) และจะทำ Phase 2 ต่อบน branch ของตัวเอง
- **ไม่ commit `docs/assignment.pdf`** เพราะเป็นเอกสารโจทย์ของผู้สรรหา และ remote บน GitHub อาจเป็น public — ใส่ไว้ใน `.gitignore` พร้อมคอมเมนต์ (ลบบรรทัดนั้นได้ถ้าต้องการ commit)
- ตรวจก่อน commit ว่าไม่มี `.env`, Prisma Client ที่ generate, `dist/`, `.next/` และสแกนหา secret ในไฟล์ที่จะ commit
- 20:27 commit `8a92fd1` บน branch `phase-1-foundation` (59 ไฟล์, ยังไม่ push)

**Phase 2 — สิ่งที่ AI ทำ (20:28–20:53) บน branch `phase-2-auth-crm-api`**

- ตรวจ library ใหม่ 3 ตัว (`jose`, `cookie`, `express-rate-limit`) ว่า publish มาเกิน 1 วันแล้ว และอ่าน type definition จริงก่อนใช้ — พบว่า `cookie` v2 เปลี่ยนชื่อ `parse` → `parseCookie` และ `express-rate-limit` v8 ต้องใช้ `ipKeyGenerator` เมื่อเขียน keyGenerator เอง
- ทดสอบพฤติกรรม `bcryptjs` กับรหัสผ่าน > 72 bytes (ภาษาไทย 3 bytes/ตัว) ก่อนออกแบบ validation → ตัดเงียบๆ ไม่ throw จึงไม่ทำให้ login ล่ม
- สร้าง contract ใน `packages/shared` (input + response schemas) และ API 23 endpoints: auth (login/logout/me), users, companies, contacts, leads (list/search/filter/sort/cursor, pipeline, create, detail, update พร้อม audit, stage change), timeline, activities
- ออกแบบ `route()` helper ให้ทุก endpoint ต้องประกาศ auth level + zod schema — เพราะ Express 5 ทำให้ `req.query` แก้ไขไม่ได้ (middleware `validate()` แบบเดิมจึงใช้ไม่ได้)
- ผลการตรวจ: test 106/106 ผ่าน (รวม **core CRM flow** ที่โจทย์บังคับ), lint + typecheck + build ผ่าน; smoke test ผ่าน Next proxy ด้วยข้อมูล seed ครบทุกขั้น (login → อ่าน → สร้าง lead → stage ผิดกติกา 409 → LOST ไม่มีเหตุผล 400 → ย้าย stage → audit → 403 → logout)

**สิ่งที่ตรวจเจอและแก้**

- `pg` เตือน DeprecationWarning ระหว่าง test → ใช้ `--trace-deprecation` หาต้นทาง พบว่าเกิดจากการอ่าน lead detail (relation ซ้อน) ภายใน `$transaction` ทำให้ Prisma ยิง query ขนานบน connection เดียว (จะพังใน pg@9) → ย้ายการอ่านไปหลัง commit แล้ว warning หายไป
- test ค้นหาด้วยชื่อบริษัทที่ AI เขียนเองคาดผลผิด (คิดว่าค้นจากบริษัทของ contact แต่ระบบค้นจากบริษัทที่ผูกกับ lead ตามที่ออกแบบ) → แก้ test ให้ตรวจแต่ละ field แยกกันชัดเจน
- smoke test รอบแรกได้ 500 เพราะ script ของ AI รอ health ด้วย `curl -s` ซึ่งผ่านแม้ได้ 500 ขณะ API ยังไม่ขึ้น → เปลี่ยนเป็น `curl -f` แล้วรันใหม่ผ่านทั้งหมด (log ของ API ไม่มี error)
- smoke test สร้าง lead "[smoke test] Phase 2" ไว้ใน DB dev (ล้างได้ด้วย `pnpm db:seed -- --reset`)

**Human review** — 20:57 ผู้ใช้อนุมัติให้ commit Phase 2 (ดู #6)

---

### #6 · 20:57 — commit Phase 2 และเริ่ม Phase 3

**Prompt** (ตอบคำถาม "commit Phase 2 แล้วเริ่ม Phase 3 เลยไหม")

> ได้

**สิ่งที่ AI ทำ**

- 20:59 commit Phase 2 (`fa3ea26`) บน branch `phase-2-auth-crm-api` แล้วแตก branch `phase-3-web-ui-deploy` ต่อจากนั้น

**Phase 3 — สิ่งที่ AI ทำ (21:00–21:57)**

- อ่านเอกสาร Next.js 16 ใน `node_modules` ก่อนเขียน (ตามที่ `apps/web/AGENTS.md` ของ Next บอก) — พบว่า `middleware.ts` เปลี่ยนเป็น `proxy.ts`, `params` ต้อง `await`, standalone output ใน monorepo ต้องตั้ง `outputFileTracingRoot`
- ตรวจ library ใหม่ (Tailwind 4.3, TanStack Query 5.102) ว่า publish มาเกิน 1 วัน; ติดตั้ง react-hook-form แล้ว**ถอดออก**เมื่อออกแบบให้ทุกฟอร์ม validate ด้วย schema ของ shared ตัวเดียวกับ API (พบว่า zod v4 มี locale ภาษาไทย → error ในฟอร์มเป็นภาษาไทย)
- สร้างหน้าเว็บ: login, Leads (filter เก็บใน URL), รายละเอียด lead (ย้าย stage, Lost ต้องมีเหตุผล, timeline, เพิ่มกิจกรรม, แก้ไข), สร้าง lead, Pipeline board, Contacts, Companies — ใช้ได้บนมือถือ
- ทดสอบ `prisma generate` โดยไม่มี `DATABASE_URL` ก่อนเขียน Dockerfile → พบว่า `env()` ของ Prisma throw → เปลี่ยนเป็น `process.env`
- เขียน Dockerfile ของ api/web, `railway.json`, `docker-compose.prod.yml` และ `docs/deploy-railway.md` (ตรวจ schema ของ `railway.json` จากเอกสาร Railway แทนการเดา)
- **ตรวจใน browser จริง** (Chrome ผ่าน `playwright-core` ใน scratchpad — ไม่มี `chromium-cli`) ทั้งบน dev server และบน production container: login ผิด/ถูก, filter + refresh, validation ของฟอร์ม, สร้าง lead, ย้าย stage (รวม Lost ที่ต้องมีเหตุผลและ reopen), บันทึกกิจกรรม, pipeline, มือถือ, logout, cookie ปลอม
- ตรวจว่าข้อมูลอยู่รอดหลัง restart ทั้ง db + api + web ใน production stack → lead, timeline และตัวเลข pipeline ตรงกันก่อน/หลัง
- ผลการตรวจ: test 121/121 (เพิ่ม test ของ web lib 15 ตัว), lint + typecheck + build ผ่าน

**สิ่งที่ตรวจเจอจาก browser จริงแล้วแก้** (test อัตโนมัติไม่จับ)

- **logout แล้ว redirect ซ้อนกัน (bug จริง)** — เจอเฉพาะบน production build: `queryClient.clear()` ทำให้ query ที่ค้างอยู่ refetch แล้วได้ 401 → ตัวจัดการ 401 พาไปหน้า login พร้อมกับการ logout → เปลี่ยนเป็น hard navigation + flag กันตัวจัดการ 401 ระหว่าง logout
- เมนูบนมือถือถูกตัด ("Contacts" เหลือ "C") และชื่อ lead ยาวถูกตัด → เมนูขึ้นแถวของตัวเองบนจอเล็ก, หัวข้อตัดบรรทัดแทน
- ช่อง filter "ที่มา" ยืดเต็มแถว เพราะ class `w-auto` ชนกับ `w-full` → เพิ่ม prop `compact` แทนการ override ด้วย className
- ทุกการ์ดใน pipeline สร้าง `<dialog>` ซ่อนไว้ (~100 ตัว) → mount dialog เฉพาะตอนเปิด
- favicon หาย (404) → เพิ่ม `icon.svg` และยกเว้นใน matcher ของ proxy
- React เตือน hydration mismatch → ตรวจแล้วเป็นผลจาก Playwright แทรก style ซ่อน caret ก่อน hydrate (ไม่ใช่ bug ของแอป) — ยืนยันโดยรันใหม่ด้วย `caret: 'initial'` แล้ว warning หายไป
- ปุ่มบันทึกกิจกรรมแสดง "บันทึกบันทึก" และ `Button` ที่รับ `disabled={false}` ตอน loading ยังกดได้ → แก้ข้อความ และย้าย `disabled` ไปหลัง spread
- image ของ api ใหญ่ 1.54GB → ตรวจด้วย `du` พบ pnpm store + cache ติดมา ~850MB → ใช้ BuildKit cache mount เหลือ 961MB (ที่เหลือคือ dev dependency ที่ pre-deploy ต้องใช้ — บันทึกเป็น next step)

**ยังไม่ได้ทำ (ต้องใช้บัญชีของผู้ใช้)** — deploy จริงบน Railway: ต้อง push repo ขึ้น GitHub และสร้าง service ใน Railway ตาม `docs/deploy-railway.md`

**Human review** — Phase 3 รอผู้ใช้ review, ยังไม่ commit

---

### #7 · 22:07 — ผู้ใช้ขอให้ตอบเป็นภาษาไทย

**Prompt**

> ขอ response เป็นภาษาไทย

**สิ่งที่ AI ทำ** — บันทึกเป็น memory ของ Claude Code (ใช้กับทุก session ถัดไป) และสรุปงาน Phase 3 ใหม่เป็นภาษาไทยที่ใช้คำอังกฤษน้อยลง

---

### #8 · 22:11 — commit Phase 3 และทำ Phase 4 จนจบ

**Prompt**

> commit Phase 3 เลย ยังไม่ต้อง Push อยากให้ทำ Phase 4 - จบ ต่อไปเพื่อให้ทดลองบน local ได้ก่อน จากนั้นเขียน step deploy เพื่อไป deploy

**สิ่งที่ AI ทำ**

- 22:13 commit Phase 3 (`f440183`) บน branch `phase-3-web-ui-deploy` (ไม่ push) แล้วถามวิธี commit ของ phase ที่เหลือ → ผู้ใช้เลือก **"commit ทีละ phase เอง"** (branch ต่อ phase, commit ในเครื่อง ไม่ push)

**Phase 4 — สิ่งที่ AI ทำ (22:17–23:05)** บน branch `phase-4-ai-copilot`

- 22:17–22:18 **ตรวจ SDK จากซอร์สใน `node_modules` แทนการเดา**: `@anthropic-ai/sdk` 0.125.0 (publish เกิน 1 วันตามกติกา pnpm), `client.messages.parse()` + `zodOutputFormat()` จาก `@anthropic-ai/sdk/helpers/zod`, พฤติกรรมเมื่อ output ไม่ตรง schema (throw `AnthropicError`), class ของ error (`APIUserAbortError`, `APIConnectionTimeoutError`, `APIError`) และ `output_config: { format, effort }` — ใช้ข้อมูลนี้ออกแบบการแยกเหตุผลของ fallback
- 22:20–22:27 schema ของ AI ใน `packages/shared` + package `skills/crm-copilot`: prompt, Claude provider, mock provider, guardrails, กติกาสำรอง, `runCrmCopilot` (ไม่ throw, มี timeout) และ eval 7 เคส + CLI (`pnpm --filter @ai-crm/crm-copilot eval`) → รันกับกติกาสำรองผ่าน 7/7
- 22:29 `skills/crm-copilot/SKILL.md` (purpose, inputs, outputs, allowed actions, guardrails, failure behavior, eval 7 เคส) + env ของ AI + Dockerfile คัดลอก skill เข้า image
- 22:30–22:34 API: `LineClient` + mock + การส่งซ้ำด้วย `retryKey` เดิม, context builder (ไม่ส่ง email/phone/lineUserId ให้ AI), service ขอ/อนุมัติ/ไม่ใช้ suggestion, endpoints 4 ตัว, `/api/health` บอกโหมด AI/LINE และ **test ที่โจทย์บังคับ #2** (11 test: fallback ทุกเหตุผล, ไม่มีข้อมูลเปลี่ยนก่อนอนุมัติ, อนุมัติซ้ำได้ 409, ส่ง LINE ครั้งเดียว, LINE ล่มแล้วข้อความเป็น FAILED, supersede, field ที่แก้ไม่ได้ได้ 400)
- 22:36–22:37 เว็บ: แผง AI Copilot ในหน้า lead (การ์ด "รออนุมัติ — ยังไม่ถูกบันทึก", แก้ไขก่อนอนุมัติ, ป้าย "กติกาสำรอง" พร้อมเหตุผล, คำเตือนจาก guardrail) และ timeline แสดงว่าอนุมัติจาก AI หรือกติกาสำรอง และแก้ไขก่อนอนุมัติหรือไม่
- 22:49 **ตรวจใน Chrome จริง** (`playwright-core`): health `{"ai":"fallback","line":"mock"}` → ขอคำแนะนำได้ 3 การ์ด → แก้คะแนนเป็น 55 แล้วอนุมัติ (timeline: "คะแนน: — → 55 · กติกาสำรอง · แก้ไขก่อนอนุมัติ") → สร้างงาน → แก้ข้อความแล้วส่ง LINE จำลอง ("ส่งแล้ว · ร่างโดย AI") → ไม่ใช้พร้อมเหตุผล → มือถือ; ไม่มี console error
- 22:50–22:54 build image ของ api ใหม่ ยืนยันว่ามี `skills/crm-copilot` อยู่ใน image
- ผลการตรวจ: test 160/160 (15 ไฟล์) ผ่าน 5 รอบติด, lint + typecheck + build ผ่าน

**สิ่งที่ AI ตรวจเจอเองแล้วแก้**

- IDE เตือนว่าค่าปลอมใน `env.test.ts` หน้าตาเหมือน credential → เปลี่ยนเป็น `FAKE_TEST_VALUE` ให้เห็นชัดว่าไม่ใช่ secret
- seed เขียน "สร้าง lead จากLINE OA" (ไม่มีวรรคหน้าคำอังกฤษ) → แก้ข้อความ
- `watchPatterns` ของ api ไม่มี `skills/**` → แก้ prompt บน Railway แล้วจะไม่ deploy ใหม่ → เพิ่มแล้ว
- **test ล้มแบบสุ่ม — AI เดาสาเหตุผิดในรอบแรก**: 22:39 test health ล้ม 2 ครั้งแต่ AI กรอง log ด้วย `grep` จนข้อความ error หาย; รันซ้ำ 18 รอบ + รันใต้ CPU load ก็ไม่ล้ม จึงเดาว่า DB ตอบช้าแล้วเพิ่ม `testTimeout` (ไม่ใส่ retry เพราะจะกลบ test ที่พังจริง) และเปลี่ยนมาเก็บ log เต็ม → 22:56 ล้มอีกครั้ง คราวนี้เห็น error จริง `Parse Error: Expected HTTP/` → อ่านซอร์ส supertest พบว่ามัน listen บน `::` แต่ต่อ `127.0.0.1` และ `lsof` เห็นโปรแกรมอื่นในเครื่อง (VS Code, java, LINE) จับพอร์ตสุ่มบน `127.0.0.1` อยู่ → เขียน script 15 บรรทัดจำลองได้ error เดียวกันเป๊ะ → แก้ให้ `createTestApp` listen บน `127.0.0.1` เอง (OS ไม่ยอมให้ซ้ำพอร์ต — ยืนยันด้วย `EADDRINUSE`) และ**ถอด `testTimeout` ที่เพิ่มจากการเดาผิดออก**

**ยังไม่ได้ทำ** — รัน eval กับ Claude จริง: เครื่องนี้ไม่มี `ANTHROPIC_API_KEY` (ผู้ใช้ใส่เองใน `apps/api/.env` แล้วรัน `pnpm --filter @ai-crm/crm-copilot eval`)

**Human review** — Phase 4 commit ตามที่ผู้ใช้สั่ง (22:11, "commit ทีละ phase เอง") รอผู้ใช้ review บน branch

**Phase 4 commit** — 23:07 `d376f06` บน branch `phase-4-ai-copilot` (ไม่ push) แล้วแตก branch `phase-5-line-oa` ต่อ

**Phase 5 — สิ่งที่ AI ทำ (2026-09-13 23:07–23:38)** ยังอยู่ในคำสั่ง #8 ("ทำ Phase 4 - จบ")

- 23:08–23:10 **ตรวจ API ของ LINE จากแหล่งทางการก่อนเขียน**: หน้า reference ของ LINE เป็นแค่สารบัญ → ดาวน์โหลด OpenAPI ทางการ (`line/line-openapi`: `messaging-api.yml`, `webhook.yml`) มาอ่าน + เอกสาร LINE Developers เรื่องตรวจลายเซ็น, retry key (อายุ 24 ชม., 409 = รับไปแล้ว, retry เฉพาะ 5xx / timeout), การรับ webhook (ใช้ `webhookEventId` กันซ้ำ, ปุ่ม Verify ส่ง `events: []`); หาเพดานความยาวข้อความในสเปกไม่เจอ → ตั้งเพดานของเราเอง 2,000 ตัวอักษรและเขียนไว้ชัดว่าไม่ใช่ขีดจำกัดของ LINE
- 23:16–23:21 shared schema (ส่งข้อความ, webhook event), env (`LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` บังคับเมื่อ `live`), ตรวจลายเซ็น, HTTP client ของ LINE (ไม่ใช้ SDK), รับ webhook → บันทึก → ตอบ 200 → คิวประมวลผล, map LINE user → contact / lead, retry worker, endpoint ส่งเอง / ส่งซ้ำ / admin ดู-สั่งประมวลผล event ซ้ำ
- 23:23–23:25 **test ที่โจทย์บังคับ #3** (`webhook.test.ts`) + test การส่ง / ส่งซ้ำ, HTTP client (fetch ปลอม), คิว; เพิ่มโหมด `afterAccept` ใน LINE จำลองเพื่อพิสูจน์ว่า "LINE รับแล้วแต่คำตอบหาย" ลูกค้าได้ข้อความครั้งเดียว
- 23:30 **mutation test**: แก้โค้ดชั่วคราวให้ยอมรับทุกลายเซ็น → test ความปลอดภัยล้ม 2 ตัว; ปิด `skipDuplicates` → test กันซ้ำล้ม → คืนโค้ดเดิม (ยืนยันว่า test จับ bug ได้จริง ไม่ได้ผ่านเพราะเขียนหลวม)
- 23:30–23:33 `pnpm line:simulate`, หน้าเว็บ: ช่องพิมพ์ตอบ LINE (ป้าย "โหมดจำลอง"), ข้อความส่งไม่สำเร็จแสดงเหตุผล + ปุ่ม "ส่งอีกครั้ง", การ์ด AI บอกว่า "ร่างอัตโนมัติเมื่อลูกค้าทักเข้ามาทาง LINE"
- 23:34 เจอ `pnpm dev` ค้างอยู่ตั้งแต่ ~20:19 (ไม่มี terminal ผูก — ของ AI เองจากรอบก่อนที่ปิดไม่หมด) → ตรวจ process ก่อนแล้วจึงปิด
- 23:35–23:37 ทดลองจริงบนเครื่อง (secret ชั่วคราวส่งผ่าน env ไม่แก้ `.env` ของผู้ใช้): webhook ใหม่ 200 / ซ้ำ `duplicates: 1` / ลายเซ็นผิด 401 → เปิดใน Chrome เห็น lead ใหม่ไม่มีเจ้าของ + ข้อความ + ร่าง AI 3 ใบ → อนุมัติคำตอบ → พิมพ์ตอบเอง → มือถือ; ไม่มี console error
- 23:38 session หยุดระหว่างแก้ข้อความทักทาย

**สิ่งที่ AI ตรวจเจอจาก browser จริงแล้วแก้** (test อัตโนมัติไม่จับ)

- timeline ขึ้น "สร้าง lead จากข้อความ LINE" **เหนือ**ข้อความแรกของลูกค้า — activity ใช้เวลาตอนประมวลผล แต่ข้อความใช้เวลาที่ลูกค้าส่ง → ให้ activity ก่อนข้อความ 1 ms และเพิ่ม test
- timeline ขึ้น "ระบบ · ระบบ" สำหรับ activity ที่ระบบสร้างเอง → แสดงครั้งเดียว
- ร่างของกติกาสำรองขึ้นต้น "สวัสดีคุณLINE" (ไม่มีวรรคหน้าชื่ออังกฤษ) และชื่อชั่วคราวเดิม "ผู้ใช้ LINE …" จะกลายเป็น "สวัสดีคุณผู้ใช้" → ชื่ออังกฤษเว้นวรรค, ชื่อชั่วคราวเป็น "ลูกค้า LINE …" (อ่านเป็น "สวัสดีคุณลูกค้า"), เพิ่ม `PROMPT_VERSION` เป็น `crm-copilot@2` และรัน eval ตามกติกาใน `CLAUDE.md`
- `pnpm line:simulate` พิมพ์ "เปิดหน้า Leads…" แม้ได้ 401 → พิมพ์เฉพาะตอนสำเร็จ และคืน exit code 1 เมื่อล้ม
- error handler log 503 ที่ตั้งใจตอบ (webhook ยังไม่ตั้งค่า) ว่า "unhandled error" → เปลี่ยนเป็น warn

---

### #9 · 2026-09-14 03:15 — ทำต่อ

**Prompt**

> ทำต่อ

**สิ่งที่ AI ทำ (03:15–03:25)**

- แก้ 3 จุดที่ค้างจากการตรวจในเบราว์เซอร์ (รายการด้านบน) + test ใหม่ (ลำดับ timeline, ดึงโปรไฟล์ LINE ไม่ได้แต่ยังบันทึกข้อความ, คำทักทายชื่อไทย/อังกฤษ) → eval 7/7
- ตรวจใน Chrome อีกรอบด้วยผู้ใช้ LINE คนใหม่: ลำดับ timeline ถูก, "ระบบ" ขึ้นครั้งเดียว, ร่างขึ้นต้น "สวัสดีคุณ LINE"
- **ตรวจกรณีส่งไม่สำเร็จกับ LINE จริง**: รัน api แบบ `LINE_MODE=live` + token ปลอม → LINE ตอบ `401 Authentication failed...` → client อ่านข้อความ error ของ LINE ได้ถูก, ไม่ retry เอง (4xx), หน้าเว็บขึ้นกล่องสีแดง + เหตุผล + ปุ่ม "ส่งอีกครั้ง" → กดแล้วยังล้มพร้อม toast
- ตัวอย่าง request ของ AI / LINE / admin ใน `requests.http`, ขั้นตอนตั้งค่า LINE OA จริงใน `deploy-railway.md` (ชื่อเมนูตรวจจากเอกสาร LINE: สร้าง channel ผ่าน LINE Official Account Manager เท่านั้นตั้งแต่ ก.ย. 2024, webhook ต้อง HTTPS)
- ผลการตรวจ: test 192/192 ผ่าน 2 รอบติด, lint + typecheck + build ผ่าน

**ยังไม่ได้ทำ (ต้องใช้บัญชีของผู้ใช้)** — สร้าง LINE OA จริง, ใส่ channel secret / token ใน Railway, ทดสอบจากมือถือ

**Human review** — Phase 5 commit ตามคำสั่ง #8 ("commit ทีละ phase เอง") รอผู้ใช้ review บน branch

**Phase 5 commit** — 03:26 `dc55ceb` บน branch `phase-5-line-oa` แล้วแตก branch `phase-6-hardening-handover` ต่อ

**Phase 6 — สิ่งที่ AI ทำ (03:26–03:50)**

- 03:26–03:27 `pnpm audit --prod` เจอ 3 รายการ (high 2) → ไล่ path พบว่าทั้งหมดอยู่ใน Prisma CLI และ Prisma 7.10.0 (ล่าสุดของ 7.x) pin เวอร์ชันนั้นไว้เอง → **ตัดสินใจไม่ override** dependency ภายในของ Prisma (เสี่ยงทำ migrate พัง, โค้ดส่วนนั้นไม่รับ input จากภายนอก) แต่บันทึกเป็นความเสี่ยงที่ยอมรับพร้อมเหตุผลใน README — **ผู้ใช้ควรตรวจการตัดสินใจนี้**
- 03:27–03:28 helmet 8.3.0 (ตรวจอายุ release) ให้ API; อ่านเอกสาร Next 16 ใน `node_modules` แล้วตั้ง CSP / HSTS / X-Frame-Options ฯลฯ ให้เว็บ — ตัด `upgrade-insecure-requests` ออกจากตัวอย่างในเอกสาร เพราะจะทำให้ production stack ในเครื่อง (http) พัง
- 03:29–03:33 ฟอร์ม "ติดต่อเรา" `/contact-us` + `POST /api/public/leads` (rate limit ต่อ IP, honeypot, consent ตาม PDPA, ไม่เขียนทับ contact เดิมจาก input สาธารณะ, ไม่บอกว่าอีเมลมีในระบบไหม) และ `GET /api/ops/summary` (admin) สำหรับ monitor + test
- 03:34–03:38 **ตรวจบน production image** (docker compose): header ครบทั้ง web / api, ฟอร์มสาธารณะส่งได้และ lead ขึ้นในระบบ, ทุกหน้าไม่มี CSP violation, สคริปต์ตรวจของ Phase 3–4 ผ่านซ้ำ, **LINE webhook ผ่าน rewrite ของเว็บได้** (ลายเซ็นตรง) → เปลี่ยนคำแนะนำ deploy ให้ `api` ไม่ต้องมี public domain เลย (ลดพื้นผิวการโจมตี และแก้ข้อจำกัดเรื่อง IP ปลอมที่บันทึกไว้ใน Phase 3)
- 03:38–03:39 สแกนประวัติ git ทั้ง 6 commit หา secret: เจอ 3 จุดแต่เป็นค่าตัวอย่างทั้งหมด, ไม่เคย commit `.env` / PDF
- 03:39–03:46 `monitoring.md` (ดึงรายชื่อ log จากโค้ดจริง), `deploy-railway.md` ฉบับสุดท้าย (push ขึ้น GitHub, Railway, smoke test, LINE OA, รายการส่งงาน), README ฉบับเต็ม (ตรวจ endpoint / query / cookie ที่อ้างถึงกับโค้ดแล้ว)

**สิ่งที่ AI ตรวจเจอเองแล้วแก้** — ช่องในฟอร์มสาธารณะที่กรอกผิดไม่มี `aria-invalid` (กรอบไม่แดง, screen reader ไม่รู้) → เพิ่มทุกช่อง; คำสั่ง `docker compose logs` ต้องมี `JWT_SECRET` ตอนอ่านไฟล์ → ระบุไว้ในเอกสาร

**ยังไม่ได้ทำ (ต้องใช้บัญชี / คนทำ)** — push ขึ้น GitHub, deploy บน Railway, ตั้งค่า LINE OA จริง + QR, อัดวิดีโอ walkthrough

**Human review** — Phase 6 commit ตามคำสั่ง #8 รอผู้ใช้ review ทั้ง 6 branch ก่อน merge เข้า `main` และ push

---

### #10 · 2026-09-14 10:44 — สร้าง skill สำหรับรันและขับแอป

**Prompt**

> /run-skill-generator

(AI แนะนำคำสั่งนี้ไว้ท้าย #9 เพราะสคริปต์ตรวจในเบราว์เซอร์ที่เขียนไว้ทุก phase อยู่แค่ใน scratchpad)

**สิ่งที่ AI ทำ (10:44–11:05)**

- พบว่า scratchpad ถูกล้างไปแล้ว (สคริปต์ตรวจเดิมหายหมด) และ **volume ของ Docker หายทั้ง dev และ production** (DB ว่าง 0 ตาราง) → ตั้งค่าใหม่จากศูนย์ตาม README (`db:deploy` + `db:seed`) ซึ่งกลายเป็นการพิสูจน์ขั้น setup ไปในตัว
- สร้าง `.claude/skills/run-ai-crm/`: `stack.sh` (เปิด/ปิด dev stack ทั้ง process group, ปฏิเสธถ้าพอร์ตถูกใช้, รอ health), `driver.mjs` (Chrome จริงผ่าน `playwright-core` รับคำสั่งทาง stdin: login / goto / click / fill / api / ss ฯลฯ และสรุป console error / HTTP 5xx) และ SKILL.md — ทุกคำสั่งใน SKILL.md รันผ่านจริงรอบนี้ (dev stack, flow LINE → อนุมัติร่าง AI, ฟอร์มสาธารณะ, curl, เรียก AI skill ตรงๆ, test 199/199, production image บน :3100 จอมือถือ)
- ตรวจรอบสุดท้ายโดยทำตาม SKILL.md ทีละบล็อก → เจอช่องโหว่ (ลูปรอเว็บของ production image ที่ใช้ตอนตรวจแต่ไม่ได้เขียนไว้) แล้วเติม

**สิ่งที่เจอระหว่างขับแอปจริง**

- หน้า Leads render ลิงก์ซ้ำที่ถูกซ่อน (การ์ดมือถือ) → click ตัวแรกค้าง → driver เลือกเฉพาะตัวที่มองเห็น
- `text` อ่าน timeline ก่อน refetch เสร็จ (ได้ bubble ของรอบก่อน) → รอ network idle ก่อนอ่าน; header sticky โผล่กลางภาพ full-page → เลื่อนขึ้นบนสุดก่อนถ่าย
- `pnpm line:simulate … | head -1` ไม่ถึง api เลย (SIGPIPE ฆ่าก่อน POST) — ความผิดของคำสั่งทดสอบ บันทึกเป็น gotcha; `tsx` รัน `.ts` นอก package ESM เป็น CommonJS → ใช้ `.mts`
- **พบพฤติกรรมที่น่าจะเป็น bug ของแอป (ยังไม่แก้ — อยู่นอกขอบเขตงานนี้)**: กติกาสำรองตรวจภาษาจากสัดส่วนตัวอักษร (`latin > thai * 2`) ข้อความไทยปนอังกฤษ เช่น "ทดสอบบน production image" ได้ร่างคำตอบภาษาอังกฤษ — เสนอให้ถือว่ามีอักษรไทยเมื่อไรเป็นภาษาไทย (+ eval case ใหม่ + เพิ่ม `PROMPT_VERSION`)

**Human review** — commit แล้วพร้อม #11–#13 เมื่อผู้ใช้อนุมัติ (ดู #13); bug ภาษา (กติกาสำรองตรวจข้อความไทยปนอังกฤษเป็นอังกฤษ) ยังรอผู้ใช้ตัดสินใจว่าจะแก้หรือไม่

---

### #11 · 2026-09-14 11:20 — คู่มือ setup ทีละขั้นสำหรับผู้เริ่มต้น

**Prompt**

> ช่วยทำการ Set up แบบ Step by step แบบละเอียดแบบคนที่ไม่รู้สามารถไล่ทำตามได้ ทั้งการรันบน local เพื่อ dev , การ setup line , การไปเอา ANTHROPIC_API_KEY, รวมถึงการ deploy ครั้งแรก และกรณีมีการแก้ไข ลงไปเป็นไฟล์ .md ใน docs แล้วเขียน update ลง README.md ด้วย

**สิ่งที่ AI ทำ (11:20–11:55)**

- **ตรวจเอกสารทางการก่อนเขียนทุกส่วนที่เป็นเว็บของผู้ให้บริการ** (ดึงด้วย `curl`): Anthropic (`platform.claude.com` — หน้า API keys, Billing / spend limit, ประเภทและวันหมดอายุของ key, ราคา Sonnet 5 จากหน้า models), Railway (source ของเอกสารบน GitHub `railwayapp/docs`), LINE (developers.line.biz + คู่มือภาษาญี่ปุ่นของ LINE for Business สำหรับขั้นเปิด Messaging API), คำสั่งติดตั้ง nvm จาก README ทางการ
- **พบว่าขั้นตอน deploy เดิม (Phase 3/6) ใช้ไม่ได้จริงกับบัญชีใหม่ 3 จุด** แล้วแก้:
  1. Railway เลิกใช้ Config as Code — **service ที่สร้างใหม่ใช้ `railway.json` ไม่ได้** (และไฟล์เดิมหยุดถูกอ่าน 2026-12-01) → ลบ `apps/*/railway.json` แล้วเขียนค่าตั้งค่าเป็นตารางให้กรอกในหน้าเว็บ (`RAILWAY_DOCKERFILE_PATH`, Pre-deploy Command, Healthcheck Path, Watch Paths)
  2. Railway รับ BuildKit cache mount เฉพาะ id แบบ `s/<service id>-…` แต่ Dockerfile ของเราใช้ `id=pnpm-store` → เปลี่ยนเป็นลบ store ของ pnpm ในคำสั่งเดียวกับที่ติดตั้ง → build ใหม่ทั้งสอง image ผ่าน, image ของ api 978MB → 953MB, เปิด production stack แล้วขับด้วย driver ผ่าน (migrate ในขั้น pre-deploy, webhook LINE, หน้าเว็บ)
  3. ฐานข้อมูล Railway เป็น private โดยปริยาย → ขั้น seed ต้องเปิด **Public Access** ชั่วคราวก่อนจึงมี `DATABASE_PUBLIC_URL` แล้วปิดคืน
- พบข้อควรรู้ของ Railway: บัญชี **Limited Trial** (ยืนยัน GitHub ไม่ผ่าน) ออกอินเทอร์เน็ตได้จำกัด → เรียก Claude / LINE ไม่ได้ — ใส่ในคู่มือและข้อจำกัด
- **พบคำสั่งผิดในเอกสาร Phase 6**: `git push origin 'phase-*'` push ไม่ได้จริง (ทดสอบกับ bare repo) → ใช้ `'refs/heads/phase-*:refs/heads/phase-*'` (ทดสอบแล้ว push ครบ 6 branch)
- **ทดสอบส่วน "รันบนเครื่อง" แบบคนใหม่**: ปิด Postgres ตัวเดิม (ข้อมูลยังอยู่) → `git clone` ไป scratchpad → ทำตามคู่มือทีละขั้น (cp env, ตั้ง secret, install, db:up/generate/deploy/seed, dev) → login ใน Chrome เห็น Pipeline → ลองใส่ `ANTHROPIC_API_KEY` ปลอม: health ขึ้น `"ai":"claude"` แต่การ์ดขึ้น "ติดต่อ AI ไม่ได้" และ log `Claude API error 401` → ใส่ในส่วนแก้ปัญหา → ลบ clone / volume ทดสอบ แล้วเปิด Postgres เดิมคืน
- เขียน `setup-guide.md` (9 ส่วน: ภาพรวม / เตรียมเครื่อง / รันบนเครื่อง / API key / LINE ในเครื่อง / deploy ครั้งแรก / LINE OA จริง / เมื่อมีการแก้ไข / แก้ปัญหา / เช็กลิสต์ส่งงาน), ย่อ `deploy-railway.md` เป็นหน้าภาพรวม + เหตุผล + ข้อจำกัด (ลิงก์เก่ายังใช้ได้), อัปเดต README และ CLAUDE.md
- ตรวจลิงก์ในหน้าและข้ามไฟล์ด้วย `github-slugger` (ตัวเดียวกับที่ GitHub ใช้สร้าง anchor ของหัวข้อภาษาไทย) — ไม่มีลิงก์เสีย

**ยังไม่ได้ทำ / ข้อจำกัดของคู่มือ** — ส่วน Anthropic Console, Railway และ LINE ยึดตามเอกสารทางการ ณ วันที่เขียน แต่ยังไม่ได้ลองกับบัญชีจริง (ต้องใช้บัญชีของผู้ใช้) — ระบุไว้ที่หัวคู่มือ

**Human review** — ผู้ใช้ขอปรับส่วนที่ 4 ต่อ (#12) และให้ลดเอกสารก่อน commit (#13) — commit แล้วพร้อม #13

---

### #12 · 2026-09-14 15:12 — ทดสอบ LINE จริงกับระบบบนเครื่อง

**Prompt**

> ตรง 4. ลอง LINE บนเครื่อง ใน setup-guide อยากให้มี LINE จริง แต่ระบบทดสอบบนเครื่อง local ด้วย

**สิ่งที่ AI ทำ (15:12–15:25)**

- LINE ส่ง webhook ได้เฉพาะ URL สาธารณะแบบ HTTPS → เลือก **Cloudflare Quick Tunnel** (ฟรี ไม่ต้องสมัคร) — ตรวจคำสั่ง ข้อจำกัด (ทดสอบเท่านั้น, 200 request พร้อมกัน, ใช้ไม่ได้ถ้ามี `~/.cloudflared/config.yaml`) และวิธีติดตั้ง (`brew install cloudflared`, Docker image ทางการ) จากเอกสาร developers.cloudflare.com; ตรวจ `allowedDevOrigins` ของ Next 16 ว่าไม่กระทบ webhook (มีผลกับไฟล์ dev จากเบราว์เซอร์เท่านั้น) และเลือกให้ tunnel ชี้ api `:4000` ตรง
- **พบว่าผู้ใช้กำลังรัน `pnpm dev` เองอยู่** (terminal ttys004) → ไม่แตะ แต่เปิด api ของ AI แยกที่พอร์ต 4100 + tunnel ผ่าน Docker image `cloudflare/cloudflared` (ไม่ติดตั้งโปรแกรมในเครื่องผู้ใช้) → **ส่ง webhook ที่เซ็นแบบ LINE ผ่าน URL สาธารณะ `https://….trycloudflare.com`**: ข้อความถูกบันทึก, event ซ้ำได้ `duplicates: 1`, ลายเซ็นผิดได้ 401, คำขอแบบปุ่ม Verify (`events: []`) ได้ 200 → ปิด tunnel และ api ทดสอบ
- ปรับ setup-guide: ส่วนที่ 4 เป็นแบบ A (จำลอง) / แบบ B (LINE จริง: 4.2 สร้าง OA + secret / token + ปิดตอบอัตโนมัติ, 4.3 `LINE_MODE=live` ในเครื่อง, 4.4 tunnel, 4.5 webhook → tunnel, 4.6 ทดสอบจากมือถือและเลิกทดสอบ); ส่วนที่ 6 เหลือเฉพาะต่อ production; เพิ่มคำเตือน 1 channel มี webhook ได้ URL เดียว (แนะนำ OA แยกสำหรับทดสอบ), `live` = ส่งถึงคนจริง, ปิด tunnel เมื่อเลิกทดสอบ; เพิ่มแถวแก้ปัญหาของ tunnel; อัปเดตลิงก์ใน README / deploy-railway (ตรวจด้วย `github-slugger` ไม่มีลิงก์เสีย)

**ยังไม่ได้ทำ** — ขั้นที่ต้องใช้บัญชี LINE จริง (สร้าง OA, Verify ในหน้า LINE Console, ทักจากมือถือ) — ต้องใช้บัญชีของผู้ใช้

**Human review** — ผู้ใช้ขอให้ลดเอกสารก่อน commit (#13) — commit แล้วพร้อม #13

---

### #13 · 2026-09-14 15:28 — ลดเอกสารซ้ำซ้อนและลิงก์ข้ามไฟล์ก่อน commit

**Prompt**

> ก่อน commit ดูพวก docs กับ .md ว่ามีอะไรที่ไม่จำเป็นต้องใส่สำหรับ assignment นี้ไหม หรือลดการลิ้งข้าม md เพื่อความง่ายได้ไหม

**สิ่งที่ AI ทำ (15:28–15:42)**

- ไล่ทุกไฟล์ `.md` เทียบกับสิ่งที่โจทย์ต้องส่ง: README, `skills/crm-copilot/SKILL.md`, monitoring notes, AI-usage log (บังคับ) · setup-guide (ผู้ใช้ขอ) · แผน (หลักฐานว่าวางแผนก่อนและมีคน review) · `CLAUDE.md` + skill `run-ai-crm` (หลักฐานการใช้ AI coding tool) · `apps/web/AGENTS.md` / `CLAUDE.md` (`next dev` สร้างเองและจะสร้างกลับถ้าลบ)
- **ไฟล์ที่ไม่จำเป็น: `docs/deploy-railway.md`** — หลังมี setup-guide แล้วเหลือแค่ลิงก์ไป setup-guide + ของที่ README มีอยู่แล้ว → ย้ายส่วนที่ไม่ซ้ำ (คำสั่งลอง production image ในเครื่อง → setup-guide ต้นส่วนที่ 5; เหตุผลที่ตั้งค่า Railway ในหน้าเว็บ → README Key trade-offs; rewrite ส่ง body ดิบ + ลายเซ็นครบ / `TRUST_PROXY=2` → README Architecture; Limited Trial และ retry key 24 ชม. → README Known limitations) แล้วลบไฟล์
- ลิงก์ข้ามไฟล์จาก 55 เหลือ 8 (ทั้งหมดอยู่ใน README: ตัวชี้ไป setup-guide ด้านบน, SKILL.md และตาราง "เอกสาร") — ตัดลิงก์ที่เข้า anchor ของไฟล์อื่นทั้งหมด (anchor ภาษาไทยพังเงียบๆ เมื่อแก้หัวข้อ) เหลือเป็นข้อความ เช่น "setup-guide ข้อ 5.4"; `CLAUDE.md` / แผน / log ใช้ path ใน backtick (เนื้อหาใน log เดิมไม่แก้ เพราะเป็นประวัติ)
- เพิ่มกติกาใน `CLAUDE.md` หัวข้อ 6: รายชื่อเอกสารสำหรับคน, ไม่เพิ่มไฟล์ใหม่ถ้าใส่ไฟล์เดิมได้, ลิงก์ข้ามไฟล์ระดับไฟล์เท่านั้น; ตัดการอ้าง `/run-ai-crm` ออกจาก setup-guide (ผู้เริ่มต้นไม่ต้องใช้)
- ตรวจ: ลิงก์ในหน้า setup-guide 11 จุด + ลิงก์ข้ามไฟล์ทั้งหมดไม่มีเสีย (`github-slugger`), ไม่มีไฟล์ไหนอ้าง `deploy-railway` นอกจากประวัติใน log / แผน, `prettier --check` ผ่าน

**Human review** — ผู้ใช้อนุมัติ commit (15:44: "commit ได้") → งานของ #10–#13 (skill `run-ai-crm`, setup-guide, Dockerfile, ลบ `railway.json` / `deploy-railway.md`, เอกสาร) รวมเป็น 1 commit ต่อบน branch `phase-6-hardening-handover` (ก่อน commit: สแกน diff ไม่พบ secret, `pnpm audit --prod` ไม่มีรายการใหม่) — ไม่ push

---

### #14 · 2026-09-14 15:53 — merge PR #1, CI ล้ม, worktree และ Railway แยก service ตาม package

**Prompt** (5 ข้อความต่อกัน)

> ตอน merge เข้า main add Add a description แนะนำที (15:53)
>
> แก้ปิด ci.yml ไปก่อน merge เข้า main ครั้งแรก (16:02)
>
> ทำไม branch main ผมบังคับให้เปิด working tree (16:19)
>
> นอกจาก railway มีตัวอื่นไหม (16:28)
>
> @ai-crm/crm-copilot ตรง setup-guide มันติดขึ้น railway ไปด้วยต้อง deploy ไหม / กับช่วยสร้างไฟล์ CI.yml ใหม่ให้ที (16:55)

**สิ่งที่ AI ทำ**

- 15:53 ร่าง title + description ของ PR (สรุป 7 commit ตาม phase, วิธีตรวจ, security, ข้อจำกัด) และแนะนำให้ merge แบบ "Create a merge commit" เพราะ log / แผนอ้าง hash ของ commit (squash / rebase ของ GitHub เปลี่ยน hash)
- 16:02 ก่อนปิด CI ดูผลการรันจริงผ่าน GitHub API: ล้มที่ `pnpm lint` ในหน้า `[id]` 3 หน้า (`PageProps` resolve ไม่ได้) → **ลอง clone ใหม่ใน scratchpad ได้ error 9 ตัวเหมือน CI** → รัน `next typegen` ก่อนแล้ว lint / typecheck / test (199) / build ผ่านทั้งหมด = ต้นเหตุคือลำดับขั้นใน CI ไม่ใช่ bug ในโค้ด (ในเครื่องไม่เจอเพราะ `pnpm dev` สร้างไฟล์ type ไว้แล้ว) — แก้ `ci.yml` เป็นรันเองได้อย่างเดียว + เพิ่มขั้น typegen และเสนอให้เปิดกลับเลย
- 16:19 ตรวจ `git worktree list`: `main` ถูก checkout ค้างใน `../ai-crm.worktrees/main` (สร้าง 16:16 ไม่ได้มาจาก AI) และ `git fetch -u origin main:main` เลื่อน ref ไป merge commit โดยไม่อัปเดตไฟล์ → worktree นั้นเห็นไฟล์ 195 ตัว "ถูกลบ" แบบ staged (ถ้า commit จะลบทั้งโปรเจกต์บน main) — ตรวจแล้วไม่มีงานค้างจึงแนะนำ `git worktree remove --force` (ผู้ใช้ลบเอง)
- 16:28 เทียบทางเลือกนอกจาก Railway (Render, Fly.io, VPS + compose) กับเงื่อนไขของระบบ (api ต้องรันตลอด, DB อยู่ยาว, ออกอินเทอร์เน็ตได้) — ตรวจ free tier / ราคาจากเอกสารทางการ: Render แบบฟรีหลับหลัง 15 นาทีและ Postgres ฟรีหมดอายุ 30 วันจึงใช้กับ LINE webhook ไม่ได้ → แนะนำใช้ Railway ต่อถ้าไม่มีปัญหาเฉพาะ
- 16:55 ตรวจเอกสาร Railway: ตอน import monorepo Railway วาง service ให้ทุก package และตั้ง Build / Start Command (`pnpm --filter …`) + Watch Paths ให้เอง และ Start Command **ทับ CMD ของ Dockerfile** (image ของ web ไม่มี pnpm → start ไม่ขึ้น) → แก้ setup-guide ข้อ 5.4–5.5 (ลบ `@ai-crm/crm-copilot` / `@ai-crm/shared`, เปลี่ยนชื่อ, ล้าง command, เพิ่ม Watch Paths, กด Deploy ครั้งเดียวหลังตั้งทั้ง api และ web) + แถวแก้ปัญหา 2 แถว; สร้าง `.github/workflows/ci.yml` ใหม่ (trigger เดิม + `next typegen` ก่อน lint, คง action version ที่รันผ่านแล้ว) บน branch `fix-ci-railway-monorepo`; เพิ่มข้อควรรู้ใน `CLAUDE.md`

**Human review** — ผู้ใช้เลือก**ลบ `ci.yml` ทิ้ง** (commit `7a99767` ของผู้ใช้เอง) แทนเวอร์ชันที่ AI ปิด trigger แล้ว merge PR #1 ก่อน จากนั้นขอสร้างใหม่; ผู้ใช้เป็นคนเจอว่า Railway สร้าง service ของ `crm-copilot` ขึ้นมาตอนลอง deploy จริง — ยังไม่ commit รอผู้ใช้ตรวจ

---

### #15 · 2026-09-14 17:46 — ข้อ 5.6 (seed บน Railway) ละเอียดขึ้น + คู่มือทดลองใช้ทุกกรณี

**Prompt**

> ตรง 5.6 ใส่ข้อมูล demo (ทำครั้งเดียว) ผมว่ายังไม่ละเอียดแบบทำตามได้รบกวน reveiw (17:46)
>
> deploy ขึ้นหมดแล้วขอ use case ทุกกรณีพร้อมวิธีการเล่นเว็บ รวมถึง ai และ line oa (18:11 — ขัดจังหวะงานข้อ 5.6)

**สิ่งที่ AI ทำ**

- review ข้อ 5.6 จากโค้ดจริง (`prisma db seed` → `seed.ts`: ค่าจาก shell ชนะ `.env`, ใส่ข้อมูลในทรานแซกชันเดียว, ตัวกัน production / ข้อมูลซ้ำ) และตรวจเมนู Railway จากเอกสาร (Settings → Networking → Public Access, ลบ TCP Proxy ด้วยไอคอนถังขยะ)
- **ทดสอบกับฐานข้อมูลทดลองในเครื่อง** (`ai_crm_seedcheck` สร้างแล้วลบทิ้ง ไม่แตะ `ai_crm`): เก็บข้อความ error จริง 8 กรณี (ยังไม่มีตาราง, ลืม `ALLOW_PRODUCTION_SEED`, รหัสสั้น, คัดลอก URL ภายใน / แม่แบบ `${{…}}` / URL ขาด, รหัสฐานข้อมูลผิด, พอร์ตปิด = ข้อความว่าง), ลองขั้นตอนแบบ `read` ของ zsh ด้วยรหัสที่มี `'` `$` `!` แล้วตรวจ hash ว่า login ได้ (2 วินาที), ลอง `-- --reset`
- **พบข้อความที่ทำให้หลง**: seed พิมพ์ "Password: the SEED_DEMO_PASSWORD value in apps/api/.env" ซึ่งผิดสำหรับ production → แก้เป็น "…value used for this run" แต่**ผู้ใช้ย้อนการแก้ใน `seed.ts` กลับ** (ไฟล์กลับเป็นข้อความเดิม) → คงโค้ดเดิมและอธิบายในคู่มือแทนว่ารหัสของ production คือค่าที่พิมพ์ตอนรัน
- เขียนข้อ 5.6 ใหม่: เช็กลิสต์ก่อนเริ่ม → เปิดทางเข้า → คัดลอก URL พร้อมวิธีตรวจว่าถูกตัว → seed ด้วย `read` (ไม่ต้องแก้คำสั่ง, ค่าลับไม่เข้าประวัติคำสั่ง) → ผลที่ต้องเห็น → ตรวจ login ก่อนปิดทางเข้า → ปิดทางเข้า + ตาราง error 9 แถว
- 18:11 เขียน `docs/demo-guide.md` (17 กรณี: CRM, stage, audit, ฟอร์มเว็บ, AI Copilot, guardrails, LINE OA, ส่งไม่สำเร็จ / ส่งซ้ำ, admin + ลำดับวิดีโอ 3–5 นาที) โดยคัดชื่อปุ่ม / ข้อความจากโค้ดหน้าเว็บ และ**เปิดแอปในเครื่องด้วย skill `run-ai-crm` ตรวจ 2 ข้อที่ไม่แน่ใจ**: ฟอร์มติดต่อเราที่ถามราคา + สั่งระบบ → AI ขึ้นคำเตือนครบ คะแนนไม่ทำตามคำสั่ง ความมั่นใจต่ำ และ lead ที่ไม่มี LINE ได้การ์ด 2 ใบ; อนุมัติแบบแก้คะแนน → timeline "คะแนน: — → 45 · กติกาสำรอง · แก้ไขก่อนอนุมัติ"
- ระหว่างเขียนแก้ข้อความที่ไม่ถูกออกเอง: "ข้อความ LINE ที่เข้ามาระหว่าง restart ไม่หาย" (จริงเฉพาะ event ที่รับแล้ว — ตอน api ปิดอยู่ต้องพึ่ง webhook redelivery ของ LINE) และ "คะแนนไม่เป็น 100" (โค้ดบังคับแค่ความมั่นใจต่ำ — คะแนนกับ Claude ยังไม่ได้ลอง จึงอ้างผลกติกาสำรอง + เกณฑ์ eval แทน)
- เพิ่มลิงก์ใน README (ตาราง Demo + ตารางเอกสาร), รายชื่อเอกสารใน `CLAUDE.md`, ชี้เช็กลิสต์วิดีโอใน setup-guide ไปที่คู่มือใหม่
- ตรวจผลงานของ #14 ผ่าน GitHub API: CI ที่มีขั้น `next typegen` **ผ่านทั้งบน PR #2 และ push เข้า `main`** (รอบก่อนหน้าที่ไม่มีขั้นนี้ล้มที่ lint)

**Human review** — งานของ #14 ผู้ใช้ commit เอง (`b036dbd`) และ merge เป็น PR #2 แล้ว; งานของ #15 ยังไม่ commit รอผู้ใช้ตรวจ

---

### #16 · 2026-09-16 10:19 — ตรวจโจทย์จาก assignment.pdf เทียบกับงานที่ทำ + commit เอกสารที่ค้าง

**Prompt**

> อ่าน docs/assignment.pdf ทีว่าตอนนี้ยังขาดอะไรอีกไหม

**สิ่งที่ AI ทำ**

- เครื่องไม่มี poppler / pypdf / Quartz จึงถอด PDF เอง: `qpdf --qdf --object-streams=disable` แล้วเขียนสคริปต์ python แยก content stream + ถอดรหัสด้วย ToUnicode CMap ของแต่ละฟอนต์ (bfchar / bfrange, Type0 = 2 ไบต์) — ได้ข้อความครบทั้ง 5 หน้า (หน้า 1–3 JD, หน้า 4–5 โจทย์)
- เทียบข้อความจริงกับสรุปใน `CLAUDE.md` ส่วนที่ 1: **ตรงทุกข้อ ไม่มีข้อกำหนดที่ตกหล่นจากสรุป** (scenario 20 คน / 2,000 contacts / 300 active leads, เกณฑ์ 50/30/20, eval ≥ 5 เคส, timebox 5 วัน / 16 ชั่วโมง, ห้ามส่ง live secret)
- ตรวจโค้ดจริงเทียบเกณฑ์ทั้ง 3 ส่วนด้วย subagent 3 ตัวขนานกัน (Part 1 / Part 2 / Part 3) — ผลคือ **ครบตามโจทย์ทุกข้อ**: Part 1 ได้ 8 model + CHECK constraint + seed ตรงสเกลโจทย์ + responsive จริง (การ์ดบนมือถือ / ตารางบน desktop) + timeline รวม activity กับ message; Part 2 ได้ SKILL.md ครบ 9 หัวข้อ + eval 7 เคสที่รันได้จริง + approval flow ที่แยก AI ออกจาก DB write + LINE ครบ signature / idempotency 3 ชั้น / retry backoff / mock adapter; Part 3 ได้ mermaid 2 diagram + test 199 เคสครบ 3 flow ที่โจทย์บังคับ + monitoring + log นี้
- **พบปัญหาที่ผู้ประเมินจะเจอทันทีแต่ไม่เกี่ยวกับโค้ด**: branch `docs-demo-guide` ยัง 0 commits ahead ของ `origin/main` ทั้งที่มีงานค้างใน working tree — `docs/demo-guide.md` ยัง untracked (ไม่มีบน remote เลย) แต่ README ในเครื่องลิงก์ไปหา 2 จุด → คนที่ clone วันนี้ได้ลิงก์เสีย; และ Prisma CLI ทิ้ง agent-skill ไว้ 90 ไฟล์ใน `apps/api/.agents/` `.claude/` `.windsurf/` + `skills-lock.json` ที่จะหลุดเข้า repo ถ้า `git add -A`
- แก้: เพิ่ม 4 บรรทัดใน `.gitignore` (ระบุ `apps/api/` นำหน้าทุกบรรทัด — `.claude/skills/run-ai-crm/` ที่ root ยัง track อยู่ 5 ไฟล์ ตรวจแล้วไม่โดน) แล้ว commit เอกสารที่ค้างทั้งชุด
- **สิ่งที่เจอระหว่างตรวจแต่ผู้ใช้เลือกไม่แก้รอบนี้** (จดไว้เป็นข้อจำกัดที่รู้ตัว): (1) ข้อความ outbound สถานะ `QUEUED` ค้างถาวรได้ถ้า process ตายหลัง transaction commit แต่ก่อน `deliverMessage` — `retryMessage` รับเฉพาะ `FAILED` และ retry worker กวาดแค่ `WebhookEvent` ฝั่งขาเข้า ไม่มี sweeper ของขาออก; (2) คอมเมนต์ `promptVersion` ใน `schema.prisma` เขียนตัวอย่างเป็น `crm-copilot@1` แต่ของจริงคือ `@2`; (3) flag `NEGATIVE_SENTIMENT` ประกาศใน schema และแสดงบน UI แต่ไม่มี eval case ครอบ (ต่างจากอีก 4 flag)

**Human review** — ผู้ใช้เลือกจาก 4 ตัวเลือกว่าให้ **commit เอกสารที่ค้างอย่างเดียว ไม่แก้โค้ด** (ไม่แตะบั๊ก `QUEUED` และ doc drift) — commit บน branch เดิม ไม่ push ตามกติกาใน `CLAUDE.md`

---

### #17 · 2026-09-16 14:15 — เขียนขั้นตอนต่อ LINE OA เข้า production ให้ละเอียด

**Prompt**

> ผม deploy ไปหมดแล้วแต่ไม่แน่ใจวิธีการตั้งค่า LINE OA และการใช้กลับระบบเรา ช่วยเขียนแบบระเอียดที ตอนนี้ติดปัญหา
> เบื้องต้น /api/health ได้ {"status":"ok","db":"up","ai":"claude","line":"live",…}
> ไม่แน่ใจว่า set line oa บนเว็บตั้งค่าอย่างไร และบนระบบเราต้องทำอะไรก่อนบ้าง

**สิ่งที่ AI ทำ (14:15–14:35)**

- อ่าน health ที่ผู้ใช้ส่งมา → ฝั่ง Railway ครบแล้ว (`"line":"live"` = มีทั้ง secret และ token) เหลือฝั่งหน้าเว็บของ LINE
- ตรวจเอกสาร LINE ก่อนเขียน (ไม่เขียนจากความจำ): สวิตช์ **Use webhook** อยู่ในแท็บ Messaging API, ปุ่ม **Verify** แค่ยิง POST เปล่ามาและรอรหัส 200 (คนละอย่างกับ Use webhook), Response Mode (Bot / Chat) ถูกยกเลิกตั้งแต่ 30 พ.ย. 2022, มี **Webhook redelivery** และ **Error statistics aggregation** + แท็บ Webhook errors
- ตรวจ API ที่ใช้หาสาเหตุได้จาก terminal: `GET /v2/bot/channel/webhook/endpoint` (บอก URL ที่ LINE เก็บไว้ + `active`), `POST /v2/bot/channel/webhook/test` (สั่งให้ LINE ยิงมาเดี๋ยวนี้ พร้อม `statusCode` ที่ได้), `GET /v2/bot/info` (token เป็นของ OA ไหน)
- เขียนข้อ 6 ของ setup-guide ใหม่ทั้งหัวข้อ: แผนภาพว่าสวิตช์อยู่ 3 ที่ (Railway / Developers Console / OA Manager) และต้องเป็น channel เดียวกัน → 6.1 ตรวจฝั่งเราก่อนด้วย health + `curl` เข้า webhook แบบไม่มีลายเซ็นแล้วต้องได้ 401 (503 = ไม่มี secret, 404 = URL ผิด) → 6.2 ตั้ง Webhook URL / Verify / **Use webhook** / redelivery / error statistics → 6.3 ปิด Greeting / Auto-response ใน Response settings → 6.4 ทดสอบจากมือถือพร้อมตารางว่าควรเห็นอะไรใน 3 ที่ → 6.5 ตารางแปลผล 8 กรณีจาก API ของ LINE + วิธีอ่าน log ของ api
- อัปเดตข้อ 4.2 และตาราง LINE ในส่วนที่ 8 ให้ชี้มาที่ขั้นตอนใหม่

**อาการจริงที่ผู้ใช้แจ้งต่อมา (14:40)** — กด Verify แล้วได้ `The webhook returned an HTTP status code other than 200.(401 Unauthorized)` = LINE ยิงถึงระบบแล้วแต่ลายเซ็นไม่ผ่าน (URL / service ถูกต้อง) → สาเหตุคือ `LINE_CHANNEL_SECRET` ใน Railway ไม่ใช่ของ channel ที่กด Verify

- ตรวจโค้ด: `optionalSecret` ทำ `.trim()` อยู่แล้ว (ช่องว่างหัวท้ายไม่ใช่สาเหตุ) และ `LINE_MODE=live` บังคับให้มีทั้ง secret และ token ไม่งั้น api ไม่ start → แปลว่ามีค่าอยู่แต่เป็นค่าผิด
- เขียนคำสั่งแยกสาเหตุ (เซ็น event เปล่าด้วย secret ที่ผู้ใช้เห็นในหน้า Basic settings แล้วยิงเข้า production): 200 = กด Verify ผิด channel, 401 = ค่าใน Railway ไม่ใช่ค่านี้ — **ทดสอบคำสั่งกับ stack ในเครื่องผ่านเส้นทางเดียวกับ production (web → rewrite → api) แล้ว**: secret ถูก → 200 `{"received":0,"duplicates":0}`, secret ผิด / ไม่มีลายเซ็น → 401
- เพิ่มหัวข้อนี้ลง setup-guide ข้อ 6.5

**Human review** — ยังไม่ commit รอผู้ใช้ตรวจ

---

### #18 · 2026-09-16 15:04 — สคริปต์วิดีโอแบบพูดตามกดตาม

**Prompt**

> เรื่องอัดวิดีโออ้างอิงจจาก demo-guide ช่วยทำ script พูดแบบพูดตามกดตามได้เลยมาที

**สิ่งที่ AI ทำ**

- แทนตาราง "ลำดับแนะนำสำหรับวิดีโอ" เดิม (8 แถว บอกแค่ช่วงเวลากับหัวข้อ) ด้วยสคริปต์เต็มใน `docs/demo-guide.md`: 8 ฉาก คำพูดคำต่อคำ (🎙) คู่กับลำดับการกด (🖱) — **ไม่สร้างไฟล์ใหม่ ตามกติกาเอกสารใน `CLAUDE.md`**
- เพิ่มส่วน "เตรียมก่อนกดอัด" จากจังหวะจริงที่เห็นในคู่มือและโค้ด: (1) lead จาก LINE ที่ยังเปิดอยู่จะรับข้อความใหม่เข้า lead เดิม → **ต้องปิดเป็น Won / Lost ก่อนอัด ไม่งั้นไม่มี lead ใหม่ให้โชว์ในฉาก 5**; (2) ส่งฟอร์ม guardrails และกดขอคำแนะนำ AI ไว้ก่อน จะได้ไม่ต้องรอ Claude หน้ากล้อง; (3) กด Restart service ตอนเริ่มฉาก 6 แล้วค่อย refresh ในฉาก 7 — ย้ายเวลารอ 30–60 วินาทีออกจากคลิป; (4) เตือนไม่ให้แท็บ Variables ของ Railway หรือ `.env` ติดกล้อง (โจทย์ห้ามส่ง live secret)
- เขียนคำพูดให้ยาวพอดีกับช่วงเวลาแต่ละฉาก และวางประโยคคลุมช่วงที่ต้องรอระบบ (ระหว่าง Claude ตอบ / ระหว่าง webhook เข้า) + ส่วน "ถ้าเวลาเกิน ตัดฉากไหนก่อน" ที่กันฉาก AI approval กับ LINE ไว้ (30% ของคะแนนตามโจทย์)
- **ตรวจก่อนส่ง**: `grep` ชื่อปุ่ม / ข้อความ 9 รายการที่สคริปต์อ้าง (เช่น "ยืนยันคะแนนและสรุป", "รออนุมัติ — ยังไม่ถูกบันทึก", "ร่างอัตโนมัติเมื่อลูกค้าทักเข้ามาทาง LINE") กับ `apps/web/src` — ตรงทั้งหมด; 199 เทสต์ตรงกับ README; คำอธิบายกันซ้ำ 3 ชั้นตรงกับโค้ด (`WebhookEvent.eventId` unique, ข้ามสถานะ PROCESSED / IGNORED, `Message.lineMessageId` unique)
- ปรับข้อความอ้างถึงใน README (2 จุด) และเช็กลิสต์ส่งงาน setup-guide ข้อ 9 ให้ตรงหัวข้อใหม่ — ลิงก์ยังเป็นระดับไฟล์ ไม่มี anchor ภาษาไทย
- **เจอเลข entry ซ้ำ**: งานตรวจ `assignment.pdf` ตอนเช้ากับงาน LINE OA ตอนบ่ายใช้ `#16` ทั้งคู่ → แก้ของตอนบ่ายเป็น `#17` และงานนี้เป็น `#18`
- **ผู้ใช้ discard งานชุดนี้ไปโดยไม่ตั้งใจ** (ก่อน commit) → เขียนกลับทั้ง 4 ไฟล์จากเนื้อหาเดิมใน session

**Human review** — รอผู้ใช้ตรวจก่อน commit; จังหวะเวลาจริงจะพิสูจน์ได้ตอนอัดจริง

---

## Review / Reject / การเปลี่ยนแปลงหลัง human inspection

| วันเวลา | สิ่งที่ AI เสนอ | การตัดสินใจของคน | ผลที่เปลี่ยนไป |
|---|---|---|---|
| 2026-09-13 19:17 | ออกจาก plan mode แล้วพร้อมเริ่ม implement ตามแผน | **Reject** | ยังไม่เริ่มโค้ด; เก็บแผนไว้ใน `docs/plans/`, เริ่ม AI-usage log นี้ และเพิ่มกติกาใน `CLAUDE.md` ให้ทุก session บันทึกต่อ |
| 2026-09-13 19:33 | AI model `claude-opus-5` | **เปลี่ยน** เป็น `claude-sonnet-5` | ค่า default ของ `AI_MODEL` และตัวอย่างใน schema เปลี่ยนตาม; ยืนยัน Railway และ JWT cookie ตามที่เสนอ |
| 2026-09-13 22:13 | ถามวิธี commit Phase 4–6 (ทีละ phase / รวดเดียวตอนจบ) | **เลือก** commit ทีละ phase | แต่ละ phase อยู่บน branch ของตัวเองและ commit ในเครื่องทันทีที่เสร็จ ไม่ push |
| 2026-09-14 15:28 | เอกสาร 3 ชั้น (README → deploy-railway → setup-guide) ลิงก์ข้ามไฟล์ 55 จุด | **ขอให้ลด** ก่อน commit | รวม `deploy-railway.md` เข้า README / setup-guide แล้วลบ, ลิงก์ข้ามไฟล์เหลือ 8 (ศูนย์รวมที่ README), เพิ่มกติกาการเขียนเอกสารใน `CLAUDE.md` |
| 2026-09-14 16:02 | ปิด trigger ของ CI + เพิ่มขั้น `next typegen` (ต้นเหตุที่ CI ล้ม ทดสอบใน clone ใหม่แล้ว) | **ลบ `ci.yml` ทิ้งเอง** แล้ว merge PR #1 ก่อน จากนั้นขอสร้างใหม่ | CI กลับมาพร้อมขั้น typegen บน branch ใหม่; เพิ่มข้อควรรู้เรื่อง type ที่ generate ใน `CLAUDE.md` |
| 2026-09-14 16:55 | setup-guide ข้อ 5.4 เขียนตามเอกสารว่า import แล้วได้ service เดียว | **ผู้ใช้ลองจริงแล้วเจอ** service ของ `@ai-crm/crm-copilot` บน Railway | แก้ข้อ 5.4–5.5: ลบ service ที่เป็น library, ล้าง Build / Start Command ที่ Railway ใส่ให้ (ทับ CMD ของ Dockerfile), Deploy ครั้งเดียว |
| 2026-09-14 17:46 | setup-guide ข้อ 5.6 (seed บน Railway) แบบคำสั่งเดียวให้แก้ค่าเอง | **ผู้ใช้บอกว่ายังทำตามไม่ได้** | เขียนใหม่ทีละขั้นพร้อมวิธีตรวจ + ตาราง error จากการทดสอบจริง; การแก้ข้อความรหัสผ่านใน `seed.ts` ผู้ใช้ย้อนกลับ → อธิบายในคู่มือแทน |
| 2026-09-16 10:19 | ตรวจ assignment.pdf เทียบโค้ด แล้วเสนอแก้ 3 อย่าง: commit เอกสารที่ค้าง / แก้บั๊ก `QUEUED` message ค้าง / แก้ doc drift เล็กๆ | **เลือกเฉพาะ commit เอกสาร** ไม่แก้โค้ด | commit `demo-guide.md` + README / setup-guide / CLAUDE.md / log ที่ค้าง และเพิ่ม `.gitignore` กัน agent-skill ของ Prisma CLI 90 ไฟล์; บั๊ก `QUEUED` ค้างและ flag `NEGATIVE_SENTIMENT` ที่ไม่มี eval ยังคงอยู่ — บันทึกไว้ใน #16 เป็นข้อจำกัดที่รู้ตัว |
