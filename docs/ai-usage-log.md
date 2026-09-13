# AI Usage Log

บันทึกการใช้ AI coding tools ในโปรเจกต์นี้ — เป็น deliverable ของ Part 3 ("short AI-usage log: sample tasks/prompts, what you reviewed/rejected, and one meaningful change after human inspection")

- **เครื่องมือ:** Claude Code (VS Code extension), model Claude Opus 5 (1M context)
- **เวลา:** เวลาไทย (UTC+07:00) ดึงจาก timestamp ใน transcript ของ session และเวลาแก้ไขไฟล์ ไม่ได้ประมาณเอา
- **กติกา:** ทุก session ที่ใช้ AI ต้องเพิ่ม entry ต่อท้าย และอัปเดตตาราง "Review / Reject / การเปลี่ยนแปลงหลัง human inspection" ท้ายไฟล์

รูปแบบของแต่ละ entry: วันเวลา · prompt ต้นฉบับ · สิ่งที่ AI ทำ · ผลลัพธ์ · สิ่งที่คน review หรือตัดสินใจ

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

**ผลลัพธ์** — แผน (ปัจจุบันอยู่ที่ [docs/plans/2026-09-13-mvp-plan.md](plans/2026-09-13-mvp-plan.md)):

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
- 19:22–19:24 เขียน [docs/plans/2026-09-13-mvp-plan.md](plans/2026-09-13-mvp-plan.md), ไฟล์นี้ และหัวข้อ "เอกสารการทำงาน" ใน `CLAUDE.md` (ไม่ได้เขียนโค้ดและไม่ได้ commit)

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
- เขียน Dockerfile ของ api/web, `railway.json`, `docker-compose.prod.yml` และ [docs/deploy-railway.md](deploy-railway.md) (ตรวจ schema ของ `railway.json` จากเอกสาร Railway แทนการเดา)
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

**ยังไม่ได้ทำ (ต้องใช้บัญชีของผู้ใช้)** — deploy จริงบน Railway: ต้อง push repo ขึ้น GitHub และสร้าง service ใน Railway ตาม [docs/deploy-railway.md](deploy-railway.md)

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
- 22:29 [skills/crm-copilot/SKILL.md](../skills/crm-copilot/SKILL.md) (purpose, inputs, outputs, allowed actions, guardrails, failure behavior, eval 7 เคส) + env ของ AI + Dockerfile คัดลอก skill เข้า image
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

---

## Review / Reject / การเปลี่ยนแปลงหลัง human inspection

| วันเวลา | สิ่งที่ AI เสนอ | การตัดสินใจของคน | ผลที่เปลี่ยนไป |
|---|---|---|---|
| 2026-09-13 19:17 | ออกจาก plan mode แล้วพร้อมเริ่ม implement ตามแผน | **Reject** | ยังไม่เริ่มโค้ด; เก็บแผนไว้ใน `docs/plans/`, เริ่ม AI-usage log นี้ และเพิ่มกติกาใน `CLAUDE.md` ให้ทุก session บันทึกต่อ |
| 2026-09-13 19:33 | AI model `claude-opus-5` | **เปลี่ยน** เป็น `claude-sonnet-5` | ค่า default ของ `AI_MODEL` และตัวอย่างใน schema เปลี่ยนตาม; ยืนยัน Railway และ JWT cookie ตามที่เสนอ |
| 2026-09-13 22:13 | ถามวิธี commit Phase 4–6 (ทีละ phase / รวดเดียวตอนจบ) | **เลือก** commit ทีละ phase | แต่ละ phase อยู่บน branch ของตัวเองและ commit ในเครื่องทันทีที่เสร็จ ไม่ push |
