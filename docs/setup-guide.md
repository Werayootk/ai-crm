# คู่มือ Setup ทีละขั้น (สำหรับคนที่ไม่เคยทำมาก่อน)

คู่มือนี้พาทำตั้งแต่เครื่องเปล่าจนระบบขึ้นใช้งานจริงบนอินเทอร์เน็ต ทำตามลำดับหัวข้อได้เลย ไม่ต้องรู้โค้ดมาก่อน

| ส่วน | ได้อะไร | เวลาโดยประมาณ |
|---|---|---|
| [1. เตรียมเครื่อง](#1-เตรียมเครื่อง-ทำครั้งเดียว) | เครื่องพร้อมรันโปรเจกต์ | 20–30 นาที |
| [2. รันบนเครื่อง](#2-รันบนเครื่องของเรา-local-dev) | เปิดเว็บที่ http://localhost:3000 ได้ | 15–20 นาที |
| [3. เอา ANTHROPIC_API_KEY](#3-เอา-anthropic_api_key-ให้-ai-ใช้-claude-จริง) | AI ตอบด้วย Claude จริง (ไม่บังคับ) | 10 นาที |
| [4. ลอง LINE บนเครื่อง](#4-ลอง-line-บนเครื่อง) | แบบจำลอง (ไม่ต้องมีบัญชี) หรือทักจากมือถือจริงเข้าระบบบนเครื่องผ่าน tunnel | 5 นาที / LINE จริง +30 นาที |
| [5. Deploy ครั้งแรก](#5-deploy-ครั้งแรก-github--railway) | เว็บจริงบน `https://….up.railway.app` | 45–60 นาที |
| [6. ต่อ LINE OA เข้า production](#6-ต่อ-line-oa-เข้า-production) | ลูกค้าทักจากมือถือแล้วขึ้นในระบบบน Railway | 10 นาที (มี OA จากข้อ 4.2 แล้ว) |
| [7. เมื่อมีการแก้ไข](#7-เมื่อมีการแก้ไข-หลัง-deploy-แล้ว) | แก้โค้ด / ตัวแปร / ฐานข้อมูล แล้วขึ้น production อย่างปลอดภัย | — |
| [8. แก้ปัญหาที่พบบ่อย](#8-แก้ปัญหาที่พบบ่อย) | อาการ → วิธีแก้ | — |

> **ตรวจสอบแล้วแค่ไหน (2026-09-14):**
> - ส่วนที่ 2 ทดสอบจริงโดย `git clone` repo ใหม่บน macOS แล้วทำตามทีละขั้นจนเข้าเว็บได้; ข้อ 4.1 และกรณี API key ผิดในส่วนที่ 3 / 8 ทดสอบในเครื่องเดียวกัน; image ที่ใช้ deploy build และรันผ่านในเครื่อง; ขั้นที่ 3 ของข้อ 5.6 (คำสั่ง seed และข้อความ error ในตาราง) ทดสอบกับฐานข้อมูลทดลองในเครื่อง
> - ข้อ 4.4 (Quick Tunnel) ทดสอบจริง: เปิด tunnel ไปที่ api บนเครื่อง แล้วส่ง webhook ที่เซ็นแบบ LINE ผ่าน URL `https://….trycloudflare.com` — ข้อความถูกบันทึก, event ซ้ำถูกข้าม, ลายเซ็นผิดได้ 401, คำขอแบบปุ่ม Verify (`events: []`) ได้ 200; ส่วนที่ต้องใช้บัญชี LINE จริง (ข้อ 4.2, 4.5, 4.6) ยังไม่ได้ลอง
> - คำสั่งติดตั้งโปรแกรมในส่วนที่ 1 มาจากเอกสารทางการของแต่ละโปรแกรม (เครื่องที่ทดสอบติดตั้งไว้แล้ว จึงไม่ได้รันซ้ำ)
> - ส่วนที่ 3, 5 และ 6 เป็นหน้าเว็บของผู้ให้บริการ ชื่อเมนูยึดตามเอกสารทางการของ Anthropic / Railway / LINE ณ วันที่เขียน แต่**ยังไม่ได้ลองกับบัญชีจริง** (ยกเว้นขั้น import repo ในข้อ 5.4 ที่ลองจริงแล้ว — Railway แยก service ตาม package จึงปรับข้อ 5.4–5.5 ตามที่เจอ) — ถ้าหน้าตาเว็บเปลี่ยน ให้มองหาคำที่ใกล้เคียง

---

## 0. ก่อนเริ่ม

### ระบบนี้มีอะไรบ้าง

```mermaid
flowchart LR
  subgraph เครื่องของเรา
    B1[Browser] --> W1["web :3000"] --> A1["api :4000"] --> P1[("Postgres ใน Docker")]
  end
  subgraph "Railway (production)"
    B2[Browser / LINE] --> W2["web (มี domain)"] --> A2["api (ไม่มี domain)"] --> P2[(Postgres)]
  end
```

- **web** = หน้าเว็บ (Next.js) · **api** = ระบบหลังบ้าน (Express) · **Postgres** = ฐานข้อมูล
- ทุก request เข้าทาง web แล้ว web ส่งต่อ `/api/*` ให้ api — จึงเปิด domain ให้ web ตัวเดียวพอ

### บัญชีที่ต้องมี

| บัญชี | ใช้ทำอะไร | ค่าใช้จ่าย | จำเป็นเมื่อ |
|---|---|---|---|
| GitHub | เก็บโค้ด ให้ Railway ดึงไป deploy | ฟรี | ส่วนที่ 5 |
| Railway (railway.com) | รันระบบบนอินเทอร์เน็ต | trial ให้เครดิต $5 ใช้ได้ 30 วัน แล้วต้องเลือกแผน | ส่วนที่ 5 |
| Anthropic Console (platform.claude.com) | API key ของ Claude | จ่ายตามการใช้ (ต้องเติมเครดิต) — **ไม่บังคับ** ไม่มี key ระบบใช้กติกาสำรองแทน | ส่วนที่ 3 |
| LINE (Business ID) | สร้าง LINE Official Account ทดสอบ | ฟรี | ข้อ 4.2 (ทดสอบ LINE จริง) และส่วนที่ 6 |
| Cloudflare `cloudflared` | เปิด tunnel ให้ LINE เรียกเครื่องเราได้ | ฟรี ไม่ต้องสมัคร (Quick Tunnel) | ข้อ 4.4 |

### คำศัพท์ที่จะเจอ

- **Terminal** — โปรแกรมสำหรับพิมพ์คำสั่ง (macOS: กด `Cmd + Space` พิมพ์ `Terminal` แล้วกด Enter)
- **กล่องคำสั่ง** ในคู่มือ — คัดลอกไปวางใน Terminal ทีละบรรทัดแล้วกด Enter; บรรทัดที่ขึ้นต้นด้วย `#` เป็นคำอธิบาย ไม่ต้องพิมพ์; ข้อความใน `<…>` ต้องเปลี่ยนเป็นค่าของเราเอง
- **repo** — โฟลเดอร์โค้ดที่ Git ดูแล · **commit** — บันทึกการแก้ไข · **push** — ส่งขึ้น GitHub · **branch** — สายงานแยก
- **env / secret** — ค่าตั้งค่าที่เป็นความลับ (รหัสผ่าน, key) เก็บในไฟล์ `.env` บนเครื่อง หรือ Variables บน Railway — **ห้าม commit ห้ามส่งในแชต ห้ามแปะในเอกสาร**

---

## 1. เตรียมเครื่อง (ทำครั้งเดียว)

เขียนสำหรับ macOS (Windows ยังไม่ได้ทดสอบ — แนะนำใช้ WSL2 + Docker Desktop แล้วทำตามคำสั่งแบบ Linux)

### 1.1 Git

```bash
git --version
```

ถ้าขึ้นเลขเวอร์ชัน (เช่น `git version 2.47.1`) ข้ามได้ ถ้ายังไม่มี macOS จะถามให้ติดตั้ง หรือสั่ง:

```bash
xcode-select --install
```

### 1.2 Node.js 22 (ผ่าน nvm)

โปรเจกต์ใช้ Node 22 (ระบุไว้ในไฟล์ `.nvmrc`) ติดตั้งผ่าน nvm เพื่อสลับเวอร์ชันได้ง่าย — คำสั่งจาก [README ของ nvm](https://github.com/nvm-sh/nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.7/install.sh | bash
```

**ปิด Terminal แล้วเปิดใหม่** จากนั้น:

```bash
nvm install 22
node --version        # ต้องขึ้น v22.x.x
```

### 1.3 pnpm (ผ่าน corepack ที่มากับ Node)

```bash
corepack enable
```

เวอร์ชันของ pnpm ถูกกำหนดในโปรเจกต์ (`pnpm@11.20.0`) — corepack จะใช้เวอร์ชันนั้นให้เองเมื่ออยู่ในโฟลเดอร์โปรเจกต์ (ตรวจในขั้น 2.2)

### 1.4 Docker Desktop

ใช้รันฐานข้อมูล Postgres บนเครื่อง

1. ดาวน์โหลดจาก https://www.docker.com/products/docker-desktop/ — เลือกให้ตรงกับเครื่อง (**Apple chip** สำหรับ M1/M2/M3/M4 หรือ **Intel chip**)
2. เปิดโปรแกรม Docker รอจนสถานะขึ้นว่ากำลังทำงาน (ไอคอนวาฬที่แถบเมนูด้านบน)
3. ตรวจ:

   ```bash
   docker info --format '{{.ServerVersion}}'    # ต้องขึ้นเลขเวอร์ชัน ไม่ใช่ error
   ```

### 1.5 โปรแกรมเสริม (แนะนำ)

- **VS Code** (https://code.visualstudio.com) สำหรับเปิดแก้ไฟล์ `.env` — เปิดโปรเจกต์ด้วยเมนู File → Open Folder
- **Google Chrome** — ใช้เปิดเว็บ

---

## 2. รันบนเครื่องของเรา (local dev)

### 2.1 เอาโค้ดมาไว้ในเครื่อง

ถ้ามีโฟลเดอร์โปรเจกต์อยู่แล้ว ข้ามไปขั้น 2.2 ถ้ายังไม่มี (เช่นเครื่องใหม่ หลังจาก push ขึ้น GitHub แล้ว):

```bash
cd ~/Downloads                      # เลือกโฟลเดอร์ที่จะเก็บ
git clone <URL ของ repo บน GitHub> ai-crm
```

### 2.2 เข้าไปในโฟลเดอร์และเลือก Node ที่ถูกต้อง

**คำสั่งทุกคำสั่งหลังจากนี้ต้องรันในโฟลเดอร์โปรเจกต์** (ถ้าเปิด Terminal ใหม่ ให้ `cd` เข้ามาก่อนทุกครั้ง)

```bash
cd ~/Downloads/ai-crm               # เปลี่ยนเป็นที่อยู่จริงของโฟลเดอร์
nvm use                             # อ่าน .nvmrc → ใช้ Node 22
pnpm --version                      # ต้องขึ้น 11.20.0
```

### 2.3 สร้างไฟล์ตั้งค่า (.env)

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

เปิด `apps/api/.env` ด้วย VS Code (หรือ TextEdit: `open -e apps/api/.env`) แล้วแก้ **2 บรรทัด**:

1. `JWT_SECRET=` — ใช้เซ็นการ login ต้องยาวอย่างน้อย 32 ตัว ให้สร้างค่าสุ่มด้วยคำสั่งนี้ แล้วคัดลอกผลลัพธ์ทั้งบรรทัดไปวางต่อหลัง `JWT_SECRET=`

   ```bash
   openssl rand -base64 48
   ```

2. `SEED_DEMO_PASSWORD=` — รหัสผ่านของบัญชี demo ทุกบัญชี ตั้งเองอย่างน้อย 12 ตัว **จดไว้ ใช้ login ในขั้น 2.6**

บรรทัดอื่นใช้ค่าเดิมได้เลย (ฐานข้อมูลในเครื่องตรงกับ Docker ที่เตรียมไว้แล้ว) บันทึกไฟล์แล้วปิด

<details>
<summary>ทางลัด: ตั้งทั้ง 2 ค่าด้วยคำสั่ง (macOS)</summary>

```bash
sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')|" apps/api/.env
sed -i '' "s|^SEED_DEMO_PASSWORD=.*|SEED_DEMO_PASSWORD=<รหัสผ่าน demo ของคุณ>|" apps/api/.env
```

</details>

> ไฟล์ `.env` และ `.env.local` ถูกตั้งให้ Git ไม่สนใจแล้ว (ไม่ถูก commit) — ตรวจได้ด้วย `git status` ต้องไม่เห็นสองไฟล์นี้

### 2.4 ติดตั้ง dependency

```bash
pnpm install
```

ครั้งแรกอาจใช้หลายนาที (ดาวน์โหลดแพ็กเกจทั้งหมด) จบด้วย `Done in …`

### 2.5 เตรียมฐานข้อมูล

**Docker Desktop ต้องเปิดอยู่** แล้วรันทีละบรรทัด:

```bash
pnpm db:up          # เปิด Postgres ใน Docker → ต้องเห็น "Healthy"
pnpm db:generate    # สร้างโค้ดสำหรับคุยกับฐานข้อมูล → "Generated Prisma Client"
pnpm db:deploy      # สร้างตาราง → "All migrations have been successfully applied."
pnpm db:seed        # ใส่ข้อมูลตัวอย่าง (ข้อมูลสมมติทั้งหมด) → "The seed command has been executed."
```

ได้ user 20 คน, contact 2,000 ราย, lead 450 รายการ — ข้อมูลอยู่ใน Docker volume ไม่หายตอนปิดเครื่อง

### 2.6 เปิดระบบ

```bash
pnpm dev
```

รอจน Terminal ขึ้น `api listening` และ `Ready` (ครั้งแรกประมาณ 10–30 วินาที) — **เปิด Terminal นี้ทิ้งไว้** ระบบจะหยุดเมื่อปิด

เปิด Chrome ไปที่ **http://localhost:3000** แล้ว login:

- อีเมล: `sales01@demo.local` (หรือ `admin@demo.local` สำหรับสิทธิ์ admin, `sales02` … `sales19`)
- รหัสผ่าน: ค่า `SEED_DEMO_PASSWORD` ที่ตั้งในขั้น 2.3

ต้องเห็นหน้า **Leads 450 รายการ** ลองต่อได้เลย:

- **Pipeline** — board ตาม stage, เปลี่ยน stage ผ่านเมนูในการ์ด
- เปิด lead ใดก็ได้ → **ขอคำแนะนำจาก AI** → ได้การ์ด "รออนุมัติ" (ป้าย **Fallback** เพราะยังไม่ได้ใส่ API key — ปกติ)
- เปิด http://localhost:3000/contact-us — ฟอร์มสาธารณะ (ไม่ต้อง login) ส่งแล้วจะเกิด lead ใหม่ที่มา "เว็บไซต์"
- ตรวจสถานะระบบ: http://localhost:3000/api/health → `{"status":"ok","db":"up","ai":"fallback","line":"mock",…}`

### 2.7 ปิดและเปิดใหม่ครั้งถัดไป

```bash
# ปิด: กด Ctrl + C ใน Terminal ที่รัน pnpm dev แล้วสั่ง
pnpm db:down        # ปิด Postgres (ข้อมูลยังอยู่)

# เปิดครั้งถัดไป (ไม่ต้องทำขั้น 2.3–2.5 ซ้ำ)
pnpm db:up
pnpm dev
```

### 2.8 ตรวจว่าโค้ดทั้งหมดทำงานถูก (ไม่บังคับ)

```bash
pnpm test           # ต้องขึ้น "199 passed" (ใช้ฐานข้อมูลทดสอบแยก ai_crm_test — ข้อมูลในหน้าเว็บไม่หาย)
pnpm lint && pnpm typecheck && pnpm build
```

---

## 3. เอา ANTHROPIC_API_KEY (ให้ AI ใช้ Claude จริง)

**ไม่ใส่ก็ได้** — ระบบยังทำงานครบด้วย "กติกาสำรอง" (rule-based) และติดป้ายบอกชัดเจน ใส่เมื่ออยากให้สรุป / ให้คะแนน / ร่างคำตอบ ฉลาดขึ้นด้วย Claude

### 3.1 เรื่องค่าใช้จ่าย

- API ของ Claude คิดเงินตามการใช้งานจริง และ**แยกจากแพ็กเกจ Claude.ai แบบรายเดือน** — ต้องเติมเครดิตใน Console
- ระบบใช้ model `claude-sonnet-5` ราคา ณ วันที่เขียน **$2 ต่อ 1 ล้าน token ขาเข้า และ $10 ต่อ 1 ล้าน token ขาออก** (ดูราคาล่าสุดที่ [หน้า Pricing](https://platform.claude.com/docs/en/about-claude/pricing))
- กด "ขอคำแนะนำจาก AI" 1 ครั้ง = เรียก Claude 1 ครั้ง (ลูกค้าทักทาง LINE ก็เรียกอัตโนมัติ 1 ครั้งต่อชุดข้อความ) — จำนวน token ของแต่ละครั้งอยู่ใน log ของ api ที่ข้อความ `ai suggestions generated`
- แนะนำตั้ง **spend limit** (ข้อ 3.2) กันค่าใช้จ่ายบานปลาย

### 3.2 สมัคร เติมเครดิต และสร้าง key

1. ไปที่ **https://platform.claude.com** → สมัคร / login
2. เติมเครดิต: **Settings → Billing** (https://platform.claude.com/settings/billing) → เพิ่มวิธีชำระเงินและซื้อเครดิต
3. (แนะนำ) ในหน้าเดียวกัน หัวข้อ **Spend limits** → **Set limit** (หรือ **Adjust limit**) → ใส่วงเงินต่อเดือนที่รับได้ — ใช้ครบแล้ว API จะตอบ error และระบบในแอปจะใช้กติกาสำรองแทนอัตโนมัติ
4. สร้าง key: **Settings → API keys** (https://platform.claude.com/settings/keys) → **Create key**
   - **Name**: เช่น `ai-crm-local` (สร้างอีกตัว `ai-crm-production` ไว้ใส่ Railway — แยกกันจะได้ยกเลิกทีละตัวได้)
   - **Expiration**: เลือกให้ครอบคลุมช่วงที่ใช้ เช่น 30 วัน หรือกำหนดเอง — key หมดอายุแล้วแก้ไม่ได้ ต้องสร้างใหม่
   - **Linked account**: ตัวเอง (personal key)
5. คัดลอก key (ขึ้นต้นด้วย `sk-ant-`) เก็บไว้ในที่ปลอดภัยทันที

### 3.3 ใส่ key ในเครื่อง

1. เปิด `apps/api/.env` แก้บรรทัด `ANTHROPIC_API_KEY=` เป็น `ANTHROPIC_API_KEY=sk-ant-…` (วาง key ที่คัดลอกมา) แล้วบันทึก
2. restart ระบบ: กด `Ctrl + C` ใน Terminal ที่รัน `pnpm dev` แล้วสั่ง `pnpm dev` ใหม่
3. ตรวจ http://localhost:3000/api/health ต้องขึ้น `"ai":"claude"`
4. เปิด lead → **ขอคำแนะนำจาก AI** → การ์ดต้องขึ้น **"ที่มา: claude-sonnet-5 · x.x วินาที"** (ไม่มีป้าย Fallback)

> ถ้า health ขึ้น `"ai":"claude"` แต่การ์ดยังขึ้น **"Fallback — ใช้กติกาสำรอง: ติดต่อ AI ไม่ได้"** = key ผิด / หมดอายุ / เครดิตหมด — ใน Terminal ของ `pnpm dev` จะเห็น `fallbackDetail: "Claude API error 401"` (key ผิด) ดู [ข้อ 8](#8-แก้ปัญหาที่พบบ่อย)

### 3.4 วัดคุณภาพ AI (ไม่บังคับ — มีค่าใช้จ่ายเล็กน้อย: เรียก Claude 7 ครั้ง)

```bash
pnpm --filter @ai-crm/crm-copilot eval      # ต้องจบด้วย "7/7 cases passed"
```

### 3.5 ความปลอดภัยของ key

- ห้าม commit / แชร์ / แปะในแชตหรือเอกสาร — ใส่แค่ `apps/api/.env` (เครื่องเรา) และ Railway Variables (production)
- สงสัยว่าหลุด → หน้า **API keys** กด **Disable** (เปิดคืนได้) หรือ **Delete** (ถาวร) แล้วสร้างใหม่

---

## 4. ลอง LINE บนเครื่อง

มี 2 แบบ — ทำแบบ A ก่อนเพื่อดู flow แล้วค่อยไปแบบ B

| แบบ | ต้องมีอะไร | ได้อะไร |
|---|---|---|
| **A. แบบจำลอง** (ข้อ 4.1) | ไม่ต้องมีบัญชี LINE | สคริปต์ปลอมตัวเป็น LINE ส่งข้อความเข้า, ข้อความขาออกไม่ถึงใคร |
| **B. LINE จริง + ระบบบนเครื่อง** (ข้อ 4.2–4.6) | บัญชี LINE, LINE OA ทดสอบ, `cloudflared` | ทักจากมือถือจริง → ขึ้นในระบบบนเครื่อง → อนุมัติแล้วคำตอบเด้งเข้ามือถือ |

### 4.1 แบบจำลอง (ไม่ต้องมี LINE OA)

จำลองให้ "ลูกค้าทักทาง LINE" เข้าระบบในเครื่อง — ข้อความขาออกเป็นแบบจำลอง (ไม่ถึงใครจริง)

1. สร้างรหัสสุ่ม แล้วใส่ใน `apps/api/.env` บรรทัด `LINE_CHANNEL_SECRET=<ค่าที่ได้>`

   ```bash
   openssl rand -hex 16
   ```

2. restart `pnpm dev` (`Ctrl + C` แล้ว `pnpm dev`)
3. เปิด Terminal ใหม่อีกหน้าต่าง `cd` เข้าโฟลเดอร์โปรเจกต์ แล้ว:

   ```bash
   pnpm line:simulate "สวัสดีครับ สนใจทำเว็บไซต์ร้านอาหาร 3 สาขา"   # → "#1 200 {"received":1,"duplicates":0}"
   ```

4. ในเว็บ: **Leads** → ช่อง "ที่มา" เลือก **LINE OA** → เปิด lead **"ติดต่อผ่าน LINE — LINE e001"** → เห็นข้อความลูกค้าใน Timeline และการ์ด AI "ร่างอัตโนมัติเมื่อลูกค้าทักเข้ามาทาง LINE" → กด **อนุมัติและส่งทาง LINE** → ข้อความขึ้น "ส่งแล้ว · ร่างโดย AI"
5. ลองกรณีพิเศษ:

   ```bash
   pnpm line:simulate "ข้อความเดิม" --repeat 2         # LINE ส่งซ้ำ → "duplicates":1 และบันทึกครั้งเดียว
   pnpm line:simulate "ปลอม" --bad-signature           # ลายเซ็นผิด → 401 ไม่บันทึกอะไร
   ```

### 4.2 สร้าง LINE Official Account และเอา secret / token

ใช้ทั้งกับการทดสอบบนเครื่อง (แบบ B) และ production (ส่วนที่ 6) — ถ้าจะทดสอบบนเครื่องต่อหลัง deploy แล้ว แนะนำสร้าง **OA แยกไว้ทดสอบ** (ทำข้อนี้ซ้ำอีกรอบ) เพราะ 1 channel ตั้ง webhook ได้แค่ URL เดียว

**สร้าง OA (บัญชีทดสอบของเราเอง)**

1. ไปที่ https://account.line.biz/signup → สมัคร **Business ID** (ใช้บัญชี LINE หรืออีเมลก็ได้)
2. กรอกฟอร์มสร้าง LINE Official Account ให้ครบ → ได้ OA
3. เข้า **LINE Official Account Manager** (https://manager.line.biz) ต้องเห็น OA ที่เพิ่งสร้าง

**เปิดใช้ Messaging API** — ทำใน LINE Official Account Manager **บนเว็บเท่านั้น** (ทำในแอปมือถือไม่ได้):

1. เลือก OA → **Settings (ตั้งค่า)** → เมนู **Messaging API**
2. กด **Enable Messaging API** (หน้าภาษาญี่ปุ่น: 「Messaging APIを利用する」)
3. ถ้าเป็นครั้งแรก ระบบให้กรอกชื่อและอีเมลเพื่อสร้างบัญชีนักพัฒนา
4. เลือกหรือสร้าง **provider** (เช่นชื่อบริษัท / ชื่อตัวเอง) — **เปลี่ยนภายหลังไม่ได้** เลือกให้ดี
5. กดยอมรับ (同意する) → **OK** → ระบบสร้าง Messaging API channel ให้

> ตั้งแต่ 4 ก.ย. 2024 สร้าง Messaging API channel จาก LINE Developers Console โดยตรงไม่ได้แล้ว ต้องผ่านขั้นนี้เท่านั้น

**เอา channel secret และ access token** — เข้า **LINE Developers Console** (https://developers.line.biz/console/) ด้วยบัญชีเดียวกัน → เลือก provider → เลือก channel ของ OA

1. แท็บ **Basic settings** → คัดลอก **Channel secret**
2. แท็บ **Messaging API** → หัวข้อ **Channel access token (long-lived)** → กด **Issue** → คัดลอก token

**ปิดการตอบอัตโนมัติของ OA** — ในแท็บ **Messaging API** จะเห็น **Greeting messages** และ **Auto-reply messages** เป็น **Enabled** (ค่าเริ่มต้น) → กดแก้ไข ซึ่งจะพาไป LINE Official Account Manager → ตั้งทั้งสองเป็น **Disabled** (ไม่งั้น OA จะตอบลูกค้าเองซ้อนกับทีมขาย)

### 4.3 ใส่ค่า LINE จริงในเครื่อง

เปิด `apps/api/.env` แก้ 3 บรรทัด (ค่า `LINE_CHANNEL_SECRET` เดิมจากข้อ 4.1 ให้แทนด้วยของจริง) แล้วบันทึก:

```env
LINE_MODE=live
LINE_CHANNEL_SECRET=<Channel secret จากข้อ 4.2>
LINE_CHANNEL_ACCESS_TOKEN=<Channel access token จากข้อ 4.2>
```

restart `pnpm dev` (`Ctrl + C` แล้ว `pnpm dev`) → เปิด http://localhost:3000/api/health ต้องได้ `"line":"live"`

> **`live` = ส่งถึงคนจริง** — ตั้งแต่นี้การกดอนุมัติ / ส่งทาง LINE ในระบบบนเครื่องจะส่งข้อความจริงถึงคนที่เพิ่ม OA เป็นเพื่อน (lead ที่มาจาก seed เป็นข้อมูลสมมติ ส่งไม่ถึงใคร — ระบบจะขึ้น "ส่งไม่สำเร็จ") เลิกทดสอบแล้วเปลี่ยนกลับเป็น `LINE_MODE=mock`

### 4.4 เปิดทางให้ LINE เรียกเครื่องเรา (Cloudflare Quick Tunnel)

LINE ส่ง webhook ได้เฉพาะ URL สาธารณะที่เป็น **HTTPS** แต่ `localhost` เข้าจากอินเทอร์เน็ตไม่ได้ จึงใช้ **Quick Tunnel** ของ Cloudflare เปิดทางชั่วคราว (ฟรี ไม่ต้องสมัครบัญชี)

1. ติดตั้ง `cloudflared` (ครั้งเดียว — วิธีจาก [เอกสาร Cloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/)):

   ```bash
   brew install cloudflared
   ```

2. เปิด **Terminal ใหม่** (ปล่อย `pnpm dev` รันอยู่ในหน้าต่างเดิม) แล้วเปิด tunnel ไปที่ api:

   ```bash
   cloudflared tunnel --url http://localhost:4000
   ```

   รอสักครู่จะเห็นบรรทัดที่มี URL แบบ **`https://<คำสุ่ม>.trycloudflare.com`** → คัดลอกไว้ — **เปิด Terminal นี้ทิ้งไว้** ตลอดการทดสอบ

3. ตรวจว่าเข้าถึงจากอินเทอร์เน็ตได้: เปิด `https://<คำสุ่ม>.trycloudflare.com/api/health` ในเบราว์เซอร์ → ต้องเห็น JSON ที่มี `"line":"live"` (เพิ่งเปิด tunnel อาจต้องรอ 10–30 วินาที)

<details>
<summary>ไม่อยากติดตั้ง cloudflared — ใช้ Docker แทน</summary>

```bash
docker run --rm cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:4000
```

(`host.docker.internal` คือเครื่องของเราเมื่อมองจากใน Docker Desktop)

</details>

ข้อควรรู้ของ Quick Tunnel (จากเอกสาร Cloudflare):

- **URL เปลี่ยนทุกครั้งที่เปิดใหม่** → ต้องกลับไปแก้ Webhook URL ในข้อ 4.5 ทุกครั้ง
- ใช้สำหรับทดสอบเท่านั้น ไม่มีการรับประกัน uptime และรับ request พร้อมกันได้ไม่เกิน 200
- ใช้ไม่ได้ถ้ามีไฟล์ `~/.cloudflared/config.yaml` อยู่ (ต้องเปลี่ยนชื่อไฟล์นั้นชั่วคราว)
- ระหว่างเปิด ใครมี URL ก็เรียก api บนเครื่องเราได้ (ข้อมูลยังต้อง login) — **ปิดทันทีที่เลิกทดสอบ** (`Ctrl + C`)
- ใช้หน้าเว็บที่ http://localhost:3000 ตามปกติ — URL ของ tunnel มีไว้ให้ LINE เรียกเท่านั้น

### 4.5 ตั้ง webhook ให้ชี้มาที่เครื่องเรา

LINE Developers Console → channel → แท็บ **Messaging API**:

1. **Webhook URL** → **Edit** → ใส่ `https://<คำสุ่ม>.trycloudflare.com/api/webhooks/line` → **Update**
2. กด **Verify** → ต้องขึ้น **Success**
3. เปิด **Use webhook**

### 4.6 ทดสอบจากมือถือ แล้วเลิกทดสอบ

1. แท็บ **Messaging API** มี **QR code** → เปิดแอป LINE สแกนเพื่อเพิ่ม OA เป็นเพื่อน
2. ส่งข้อความหา OA เช่น "สนใจทำเว็บไซต์ครับ" → ใน Terminal ของ `pnpm dev` ต้องเห็น `line webhook received`, `contact created from line user`, `line message recorded`
3. เปิด http://localhost:3000 → **Leads** → ที่มา **LINE OA** → lead ใหม่ชื่อตามชื่อ LINE ของเรา → เห็นข้อความ + การ์ด AI "ร่างอัตโนมัติเมื่อลูกค้าทักเข้ามาทาง LINE"
4. แก้ข้อความได้ → **อนุมัติและส่งทาง LINE** → คำตอบต้องเด้งเข้ามือถือ ลองพิมพ์ตอบเองในช่อง **ตอบลูกค้าทาง LINE** ด้วย
5. เลิกทดสอบ:
   - กด `Ctrl + C` ใน Terminal ของ `cloudflared`
   - Webhook URL ใน LINE ยังชี้ URL ที่ปิดไปแล้ว → ข้อความใหม่จะไม่เข้าระบบใดเลย จนกว่าจะตั้งใหม่ (ข้อ 4.5 เมื่อทดสอบรอบหน้า หรือส่วนที่ 6 เมื่อ deploy) หรือปิด **Use webhook** ไว้ก่อน
   - แก้ `apps/api/.env` กลับเป็น `LINE_MODE=mock` แล้ว restart ถ้าไม่ต้องการให้ระบบบนเครื่องส่งข้อความจริง

---

## 5. Deploy ครั้งแรก (GitHub + Railway)

ภาพรวม: เอาโค้ดขึ้น GitHub → Railway ดึงไป build และรัน 3 ส่วน (Postgres, api, web) → seed ข้อมูล demo → ตรวจ

<details>
<summary>(ไม่บังคับ) ลอง image ชุดเดียวกับที่จะ deploy บนเครื่องก่อน</summary>

ใช้ Dockerfile ชุดเดียวกับ Railway และจัดวางแบบเดียวกัน (เข้าได้ทาง web ทางเดียว, api ไม่เปิดพอร์ตออกนอก) — Docker Desktop ต้องเปิดอยู่ เว็บอยู่ที่ http://localhost:3100

```bash
JWT_SECRET=$(openssl rand -base64 48) docker compose -f docker-compose.prod.yml up --build -d
# ครั้งแรก: ใส่ข้อมูล demo
JWT_SECRET=x docker compose -f docker-compose.prod.yml run --rm -e SEED_DEMO_PASSWORD='<≥ 12 ตัว>' -e ALLOW_PRODUCTION_SEED=true migrate pnpm --filter @ai-crm/api db:seed
# ลอง LINE ผ่านเว็บเหมือนบน Railway — ตอน up ต้องใส่ LINE_CHANNEL_SECRET=<ค่าเดียวกัน> นำหน้าด้วย
LINE_CHANNEL_SECRET=<ค่าเดียวกัน> pnpm line:simulate "สวัสดีครับ" --url http://localhost:3100
# ปิด
JWT_SECRET=x docker compose -f docker-compose.prod.yml stop
```

คำสั่ง `docker compose` ทุกตัวต้องมี `JWT_SECRET` ตอนอ่านไฟล์ — คำสั่งที่ไม่ได้เปิด api ใส่ค่าอะไรก็ได้ (`x`)

</details>

### 5.1 เตรียมโค้ดใน Git ให้พร้อม

1. ตรวจว่าไม่มีงานค้าง:

   ```bash
   git status
   ```

   - ถ้าขึ้น `nothing to commit, working tree clean` ไปข้อ 2 ได้
   - ถ้ามีไฟล์ค้างที่ต้องการเก็บ ให้ commit ก่อน (ไฟล์ `.env` ไม่ขึ้นในรายการอยู่แล้ว):

     ```bash
     git add -A
     git commit -m "<อธิบายสั้นๆ ว่าแก้อะไร>"
     ```

2. งานแต่ละ phase อยู่บน branch ต่อกันเป็นเส้นตรง รวมเข้า `main`:

   ```bash
   git switch main
   git merge --ff-only phase-6-hardening-handover
   git log --oneline -3        # บนสุดต้องเป็น commit ล่าสุดของ phase 6 (หรือ commit ที่เพิ่งทำ)
   ```

   ถ้ามี commit เพิ่มหลัง phase 6 บน branch อื่น ให้ merge branch นั้นแทน

### 5.2 เอาขึ้น GitHub (ใช้ GitHub CLI — ง่ายสุด)

1. ติดตั้ง GitHub CLI (ต้องมี [Homebrew](https://brew.sh) ก่อน):

   ```bash
   brew install gh
   gh auth login        # เลือก GitHub.com → HTTPS → Login with a web browser แล้วทำตามหน้าจอ
   ```

2. สร้าง repo แบบ private แล้ว push ในคำสั่งเดียว:

   ```bash
   gh repo create ai-crm --private --source=. --remote=origin --push
   ```

3. เปิด repo บน GitHub ตรวจว่ามีโค้ด และแท็บ **Actions** รัน CI (lint / typecheck / test / build) ขึ้นเครื่องหมายถูกสีเขียว
4. (ไม่บังคับ) เก็บ branch ของแต่ละ phase ไว้ให้ผู้ประเมินดูประวัติ:

   ```bash
   git push origin 'refs/heads/phase-*:refs/heads/phase-*'
   ```

> ตรวจว่าไม่มี secret หลุดขึ้นไป: ใน GitHub ต้องไม่มีไฟล์ `.env` (มีได้เฉพาะ `.env.example`) และไม่มี `docs/assignment.pdf`

### 5.3 สมัคร Railway และเชื่อม GitHub

1. ไปที่ **https://railway.com** → **Login** → เลือก login ด้วย **GitHub**
2. Railway จะให้ trial (เครดิต $5 ใช้ได้ 30 วัน) และ**ยืนยันตัวตนจากบัญชี GitHub** — ถ้ายืนยันไม่ผ่านจะเป็น **Limited Trial** ซึ่ง**จำกัดการออกอินเทอร์เน็ตของ service** ทำให้เรียก Claude และ LINE ไม่ได้ (AI จะใช้กติกาสำรอง, ส่ง LINE จะ "ส่งไม่สำเร็จ") → แก้ด้วยการอัปเกรดเป็นแผน **Hobby**
3. ให้ Railway เข้าถึง repo: ติดตั้ง Railway App ใน GitHub ที่ https://github.com/apps/railway-app/installations/new แล้วเลือก repo `ai-crm` (หรือทำตอน Railway ถามในขั้นถัดไป)

### 5.4 สร้างโปรเจกต์และตั้งค่า service `api`

1. หน้า Dashboard → **New Project** → **GitHub Repository** → เลือก `ai-crm` — **ยังไม่กด Deploy** (ต้องตั้งค่าก่อน)
2. Railway ตรวจเจอว่า repo นี้เป็น monorepo แล้ววาง service ให้ทุก package บน canvas (ยังเป็น staged changes ยังไม่ deploy) เช่น `@ai-crm/api`, `@ai-crm/web`, `@ai-crm/crm-copilot` — **ใช้แค่ 2 ตัว**:
   - **ลบ `@ai-crm/crm-copilot`** (และ `@ai-crm/shared` ถ้ามี) — เป็น library ที่ถูกรวมเข้าไปใน image ของ api / web อยู่แล้ว ไม่มี server ของตัวเอง deploy ไปก็ start ไม่ได้และเสียเงินเปล่า: เปิด **Settings ของโปรเจกต์** → หัวข้อ **Danger** → ลบ service นั้น
   - คลิก `@ai-crm/api` → แท็บ **Settings** → เปลี่ยนชื่อ service เป็น **`api`** (ชื่อนี้ถูกอ้างถึงในตัวแปรของ web ต้องตรงเป๊ะ) — ส่วน `@ai-crm/web` เก็บไว้ตั้งค่าในข้อ 5.5
   - ถ้า Railway สร้าง service เดียวชื่อ `ai-crm` แทน ให้เปลี่ยนชื่อตัวนั้นเป็น `api` แล้วในข้อ 5.5 สร้าง web เอง
3. เพิ่มฐานข้อมูล: กดปุ่ม **New** มุมขวาบนของหน้า canvas (หรือ `Cmd + K`) → **Database** → **PostgreSQL** → จะได้ service ชื่อ **`Postgres`**
4. สร้างค่าสุ่มสำหรับ `JWT_SECRET` บนเครื่อง (ใช้คนละค่ากับในเครื่อง):

   ```bash
   openssl rand -base64 48
   ```

5. คลิก service **api** → แท็บ **Variables** → **RAW Editor** → วางชุดนี้ (แก้ `<…>` เป็นค่าจริง) → กดบันทึก

   ```env
   RAILWAY_DOCKERFILE_PATH=/apps/api/Dockerfile
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=<ผลของ openssl rand -base64 48>
   PORT=4000
   TRUST_PROXY=2
   SESSION_TTL_HOURS=8
   LINE_MODE=mock
   ```

   - `${{Postgres.DATABASE_URL}}` คือการอ้างถึงตัวแปรของ service ชื่อ `Postgres` — ถ้า service ฐานข้อมูลชื่ออื่น ให้เปลี่ยนตาม
   - มี API key ของ Claude แล้ว เพิ่มบรรทัด `ANTHROPIC_API_KEY=<key สำหรับ production>` ได้เลย (หรือใส่ทีหลังตามข้อ 5.8)
   - `LINE_MODE=mock` ไปก่อน — เปลี่ยนเป็น `live` ในส่วนที่ 6

6. service **api** → แท็บ **Settings** ตั้งค่าตามนี้:

   | ช่อง | ค่า |
   |---|---|
   | Root Directory | เว้นว่าง (build จาก root ของ repo) |
   | Branch (trigger branch) | `main` |
   | Build Command และ Start Command | **ลบให้ว่าง** — Railway ใส่ `pnpm --filter @ai-crm/api …` ให้เองตอนแยก package ถ้าเหลือไว้ Start Command จะทับคำสั่งใน Dockerfile |
   | Watch Paths | `/apps/api/**` · `/packages/shared/**` · `/skills/**` · `/pnpm-lock.yaml` (บรรทัดละ 1 รูปแบบ — Railway ใส่ให้แค่ `/apps/api/**` ต้องเพิ่มให้ครบ) |
   | Pre-deploy Command | `pnpm --filter @ai-crm/api db:deploy` (สร้าง/อัปเดตตารางก่อนสลับเวอร์ชันทุกครั้ง) |
   | Healthcheck Path | `/api/health` |
   | Networking | **ไม่ต้อง** Generate Domain |
   | Wait for CI (ถ้ามีตัวเลือก) | เปิด — รอ GitHub Actions ผ่านก่อนค่อย deploy |

7. **ยังไม่ต้องกด Deploy** — ตั้งค่า web ในข้อ 5.5 ให้เสร็จก่อนแล้วกด Deploy ครั้งเดียว (ถ้ากดตอนนี้ web ที่ยังไม่ได้ตั้งค่าจะ build ล้ม)

### 5.5 ตั้งค่า service `web` แล้ว deploy

1. คลิก service **`@ai-crm/web`** ที่ Railway วางไว้ → แท็บ **Settings** → เปลี่ยนชื่อเป็น **`web`** (ถ้าไม่มี: **New** → **GitHub Repo** → เลือก `ai-crm` แล้วเปลี่ยนชื่อเป็น `web`)
2. **Variables** → **RAW Editor**:

   ```env
   RAILWAY_DOCKERFILE_PATH=/apps/web/Dockerfile
   API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000
   PORT=3000
   ```

   `API_URL` ชี้ไปที่ api ผ่านเครือข่ายภายในของ Railway และถูกใช้**ตอน build** (ถ้าแก้ภายหลังต้อง build ใหม่ — ดูข้อ 7.4)

3. **Settings**:

   | ช่อง | ค่า |
   |---|---|
   | Root Directory | เว้นว่าง |
   | Branch | `main` |
   | Build Command และ Start Command | **ลบให้ว่าง** — ใน image ของ web ไม่มี pnpm ถ้าเหลือ `pnpm --filter @ai-crm/web start` web จะ start ไม่ขึ้น |
   | Watch Paths | `/apps/web/**` · `/packages/shared/**` · `/pnpm-lock.yaml` |
   | Healthcheck Path | `/healthz` |
   | Networking → Public Networking | กด **Generate Domain** (ถ้าถาม port ใส่ `3000`) → ได้ `https://<ชื่อ>.up.railway.app` = **URL ของเว็บ** |
   | Wait for CI (ถ้ามี) | เปิด |

4. บน canvas ต้องเหลือ 3 service: `Postgres`, `api`, `web` → กด **Deploy** ที่แถบ **staged changes** → รอ build (หลายนาทีในครั้งแรก)
5. คลิก service api → แท็บ **Deployments** → เปิด deployment ล่าสุด ดู log:
   - Build: build จาก `apps/api/Dockerfile`
   - Pre-deploy: ต้องเห็น `All migrations have been successfully applied.`
   - Deploy: ต้องเห็น `integrations configured` และ `api listening` แล้วสถานะเป็นสำเร็จ
6. เปิด URL ของเว็บ ต้องเห็นหน้า login

### 5.6 ใส่ข้อมูล demo (ทำครั้งเดียว)

ตอนนี้ฐานข้อมูลบน Railway มีตารางแล้ว (Pre-deploy ของ api สร้างให้ในข้อ 5.5) แต่ยังไม่มีข้อมูล จึงยัง login ไม่ได้ — ขั้นนี้รันสคริปต์ seed **จากเครื่องเรา** ส่งข้อมูลสมมติ (user 20 คน, lead 450 รายการ ฯลฯ) ขึ้นไป โดยเปิดทางเข้าฐานข้อมูลจากอินเทอร์เน็ต**ชั่วคราว** แล้วปิดทันทีเมื่อเสร็จ ใช้เวลาประมาณ 10 นาที

**ก่อนเริ่ม ตรวจให้ครบ**

- [ ] ข้อ 5.5 ผ่านแล้ว: log ขั้น Pre-deploy ของ api มี `All migrations have been successfully applied.` (ถ้ายังไม่ผ่าน seed จะล้มเพราะยังไม่มีตาราง)
- [ ] เครื่องนี้เคยทำส่วนที่ 2 แล้ว (อย่างน้อยข้อ 2.1–2.4 และ `pnpm db:generate`) — ไม่ต้องเปิด Docker เพราะขั้นนี้ต่อฐานข้อมูลบน Railway
- [ ] คิดรหัสผ่าน demo ของ production ไว้แล้ว: อย่างน้อย 12 ตัว **ไม่ใช้ค่าเดียวกับในเครื่อง** และจดไว้ (ต้องส่งให้ผู้ประเมิน) — ทุกบัญชี demo ใช้รหัสนี้

**ขั้นที่ 1 — เปิดทางเข้าฐานข้อมูลชั่วคราว**

1. คลิก service **Postgres** → แท็บ **Settings** → หัวข้อ **Networking** → เพิ่ม **Public Access**
2. Railway สร้าง TCP Proxy (ที่อยู่แบบ `<ชื่อ>.proxy.rlwy.net:<พอร์ต>`) และเติมค่าให้ตัวแปร `DATABASE_PUBLIC_URL` — ถ้ามีแถบ **staged changes** ขึ้น ให้กด **Deploy**

**ขั้นที่ 2 — คัดลอก URL ของฐานข้อมูล**

1. service **Postgres** → แท็บ **Variables** → แถว **`DATABASE_PUBLIC_URL`** → คัดลอกค่า
2. ตรวจว่าคัดลอกถูกตัว — ค่าต้อง:
   - ขึ้นต้นด้วย `postgresql://` และมี `.proxy.rlwy.net:` ตามด้วยพอร์ต
   - **ไม่ใช่** `…@postgres.railway.internal…` (นั่นคือ `DATABASE_URL` ใช้ได้เฉพาะภายใน Railway)
   - **ไม่มี** `${{` (นั่นคือแม่แบบ ยังไม่ใช่ค่าจริง)
3. ในค่านี้มีรหัสผ่านของฐานข้อมูล — ห้ามส่งในแชต / แปะในเอกสาร

**ขั้นที่ 3 — รัน seed จากเครื่อง**

เปิด Terminal → `cd` เข้าโฟลเดอร์โปรเจกต์ → คัดลอกไปวาง**ทีละบรรทัด** แล้วกด Enter:

```bash
read -rs "DB_URL?วาง DATABASE_PUBLIC_URL แล้วกด Enter: "; echo
read -r "DEMO_PW?ตั้งรหัสผ่าน demo ของ production (อย่างน้อย 12 ตัว) แล้วกด Enter: "
DATABASE_URL="$DB_URL" SEED_DEMO_PASSWORD="$DEMO_PW" ALLOW_PRODUCTION_SEED=true NODE_ENV=production pnpm db:seed
```

- บรรทัดที่ 1: ตอนวาง URL **จะไม่เห็นอะไรขึ้นบนจอ** (ซ่อนรหัสผ่านของฐานข้อมูลไว้) เป็นเรื่องปกติ — วางครั้งเดียวแล้วกด Enter
- บรรทัดที่ 2: พิมพ์รหัสผ่าน demo (เห็นบนจอ ตรวจให้ถูกก่อนกด Enter) — ใช้อักขระพิเศษได้ทุกตัว
- บรรทัดที่ 3: ส่งข้อมูลขึ้น Railway — `ALLOW_PRODUCTION_SEED=true` คือการยืนยันว่าตั้งใจใส่ข้อมูลลงฐานข้อมูล production (ไม่ใส่จะถูกปฏิเสธ) ใช้เวลาไม่กี่วินาที
- ใช้ `read` แทนการแก้คำสั่งเอง: ไม่ต้องระวังเครื่องหมายคำพูด และค่าลับไม่ถูกบันทึกในประวัติคำสั่งของ Terminal
- ใช้ bash (เช่น WSL) แทน zsh ของ macOS: เปลี่ยน 2 บรรทัดแรกเป็น `read -rsp "วาง DATABASE_PUBLIC_URL: " DB_URL; echo` และ `read -rp "รหัสผ่าน demo: " DEMO_PW`

ผลที่ต้องเห็น (ตัวเลขต้องตรง):

```text
Seeded 20 users, 150 companies, 2000 contacts, 450 leads, 2041 activities, 577 messages.
Demo logins: admin@demo.local, sales01@demo.local … sales19@demo.local
Password: the SEED_DEMO_PASSWORD value in apps/api/.env
🌱  The seed command has been executed.
```

บรรทัด `Password:` หมายถึงรหัสที่ใช้ตอนรัน — ของ production คือค่าที่พิมพ์ในบรรทัดที่ 2 **ไม่ใช่**ค่าใน `apps/api/.env` ของเครื่องเรา

ข้อมูลทั้งหมดถูกใส่ในคราวเดียว — ถ้าล้มกลางทาง (เช่นเน็ตหลุด) จะไม่มีข้อมูลค้างครึ่งๆ แก้สาเหตุแล้วรันบรรทัดที่ 3 ซ้ำได้เลย (ถ้าปิด Terminal ไปแล้ว เริ่มจากบรรทัดที่ 1 ใหม่)

**ขั้นที่ 4 — ตรวจว่า login ได้ (ก่อนปิดทางเข้า)**

เปิด `https://<web-domain>` → login ด้วย `sales01@demo.local` + รหัสจากขั้นที่ 3 → ต้องเห็น **Leads 450 รายการ** — ถ้าไม่ได้ ดูตารางด้านล่าง (ตอนนี้ทางเข้ายังเปิดอยู่ แก้ได้ทันที)

**ขั้นที่ 5 — ปิดทางเข้าคืน (ห้ามข้าม)**

1. service **Postgres** → **Settings** → **Networking** → กดไอคอน**ถังขยะ**ที่ TCP Proxy (ถ้ามีแถบ staged changes ให้กด **Deploy**)
2. สั่ง `unset DB_URL DEMO_PW` ใน Terminal (หรือปิดหน้าต่าง Terminal นั้น)

ระหว่างที่เปิด ใครได้ URL ไปก็เข้าฐานข้อมูลได้ตรงๆ และ Railway คิดค่า network ของ TCP Proxy — ปิดแล้ว api ยังทำงานปกติ เพราะ api ต่อฐานข้อมูลผ่านเครือข่ายภายใน (`DATABASE_URL`) ไม่ได้ใช้ทางนี้

**ถ้าขึ้น error** — ข้อความจริงอยู่ใต้บรรทัด `Running seed command …` (บรรทัด `ERR_PNPM_…` / `ELIFECYCLE` ด้านล่างเป็นแค่ผลตามมา)

| ข้อความ | สาเหตุ / วิธีแก้ |
|---|---|
| `Database already has data…` | seed ไปแล้ว ข้อมูลอยู่ครบ ไม่ต้องทำซ้ำ — ถ้าต้องการล้างแล้ว seed ใหม่จริงๆ ให้เติม ` -- --reset` ท้ายบรรทัดที่ 3 (**ข้อมูลบน production หายทั้งหมด** รวมข้อความ LINE ที่ทดสอบไว้) |
| `Can't reach database server at postgres.railway.internal` | คัดลอก `DATABASE_URL` มาผิดตัว → กลับไปขั้นที่ 2 คัดลอก `DATABASE_PUBLIC_URL` |
| `Can't reach database server at …proxy.rlwy.net` หรือ ``Invalid `prisma.user.count()` invocation:`` ที่ไม่มีข้อความต่อ | ต่อไม่ติด: ยังไม่ได้เปิด Public Access / ยังไม่กด Deploy staged changes / ปิดไปแล้ว → ทำขั้นที่ 1 ใหม่ (URL อาจเปลี่ยน ให้คัดลอกใหม่) |
| `Invalid URL` | ค่าที่วางเป็นแม่แบบ `${{…}}` หรือไม่ใช่ URL → คัดลอกใหม่ |
| `Authentication failed against the database server…` หรือ `Database … does not exist…` | URL ถูกตัดขาด / มีตัวเกิน (คัดลอกไม่ครบ) → คัดลอกใหม่ |
| ``The table `public.User` does not exist…`` | api ยังไม่ได้สร้างตาราง → ดู log ขั้น Pre-deploy ของ api (ข้อ 5.5) ให้ผ่านก่อน |
| `SEED_DEMO_PASSWORD: must be at least 12 characters` | รหัสสั้นเกินไป → รันบรรทัดที่ 2 และ 3 ใหม่ |
| `Refusing to seed with NODE_ENV=production…` | บรรทัดที่ 3 ขาด `ALLOW_PRODUCTION_SEED=true` |
| seed ผ่านแต่ login ไม่ได้ | รหัสผ่านคือค่าที่พิมพ์ในบรรทัดที่ 2 ตอน seed (ไม่ใช่ใน `apps/api/.env`) — จำไม่ได้ให้ seed ใหม่ด้วย ` -- --reset` |

### 5.7 ตรวจหลัง deploy (smoke test)

- [ ] เปิด `https://<web-domain>/api/health` → `{"status":"ok","db":"up",…}`
- [ ] login ด้วย `sales01@demo.local` + รหัสผ่านจากข้อ 5.6 → เห็น Leads 450 รายการ
- [ ] เปิด lead → ย้าย stage (Lost ต้องใส่เหตุผล) → refresh แล้วยังอยู่
- [ ] Railway: คลิก service → **Deployments** → คลิกเข้า deployment ล่าสุด → `Cmd + K` → **Restart** ทำทั้ง `web` และ `api` → refresh เว็บ → ข้อมูลยังอยู่
- [ ] เปิด `https://<web-domain>/contact-us` → ส่งฟอร์ม → Leads กรองที่มา "เว็บไซต์" เห็น lead ใหม่
- [ ] login เป็น `admin@demo.local` แล้วเปิด `https://<web-domain>/api/ops/summary` ได้ตัวเลข JSON (ตัวเลขสำหรับ monitor — ความหมายอยู่ใน `docs/monitoring.md`)

### 5.8 เปิดใช้ Claude บน production

1. สร้าง key `ai-crm-production` ตามข้อ 3.2
2. service **api** → **Variables** → **New Variable** → `ANTHROPIC_API_KEY` = key → กด **Deploy** ที่แถบ staged changes
3. ตรวจ `https://<web-domain>/api/health` → `"ai":"claude"` แล้วลองขอคำแนะนำจาก AI ในเว็บ

---

## 6. ต่อ LINE OA เข้า production

ทำหลังข้อ 5.5 (ต้องมี URL ของเว็บแบบ HTTPS แล้ว) และต้องมี OA + channel secret / access token จาก[ข้อ 4.2](#42-สร้าง-line-official-account-และเอา-secret--token) (ถ้ายังไม่ได้ทำ ให้ทำข้อ 4.2 ก่อน — ไม่ต้องทำ 4.3–4.6)

### 6.1 ใส่ใน Railway

service **api** → **Variables** → แก้ / เพิ่ม 3 ตัว → กด **Deploy**:

```env
LINE_MODE=live
LINE_CHANNEL_SECRET=<Channel secret>
LINE_CHANNEL_ACCESS_TOKEN=<Channel access token>
```

ตรวจ `https://<web-domain>/api/health` ต้องได้ `"line":"live"` (ถ้า `LINE_MODE=live` แต่ขาดตัวใดตัวหนึ่ง api จะไม่ยอม start — ดูใน Deploy Logs)

### 6.2 ตั้ง webhook ให้ชี้ production

LINE Developers Console → channel → แท็บ **Messaging API** (ถ้าเคยชี้ไปที่ tunnel ในข้อ 4.5 ขั้นนี้คือการเปลี่ยนกลับมาที่ production):

1. **Webhook URL** → **Edit** → ใส่ `https://<web-domain>/api/webhooks/line` → **Update**
2. กด **Verify** → ต้องขึ้น **Success**
3. เปิด **Use webhook**
4. (แนะนำ) เปิด webhook redelivery ถ้ามีตัวเลือก — ระบบกันข้อความซ้ำไว้แล้ว
5. ตรวจว่าปิด Greeting / Auto-reply messages แล้ว (ท้ายข้อ 4.2)

### 6.3 ทดสอบจากมือถือ

1. แท็บ **Messaging API** มี **QR code** → เปิดแอป LINE สแกนเพื่อเพิ่มเพื่อน
2. ส่งข้อความหา OA เช่น "สนใจทำเว็บไซต์ครับ"
3. ในเว็บ production: **Leads** → กรองที่มา **LINE OA** → lead ใหม่ที่ยังไม่มีเจ้าของ → เห็นข้อความ + การ์ด AI "รออนุมัติ"
4. แก้ข้อความได้ → **อนุมัติและส่งทาง LINE** → ข้อความต้องเด้งเข้ามือถือ
5. ลองพิมพ์ตอบเองในช่อง **ตอบลูกค้าทาง LINE** ด้วย
6. เก็บภาพ QR code ไว้ส่งผู้ประเมิน — อย่าเอา webhook ของ OA ตัวนี้ไปชี้ tunnel อีก (ใช้ OA แยกสำหรับทดสอบบนเครื่อง)

ข้อความไม่ขึ้น / ส่งไม่ถึง → [ข้อ 8 หัวข้อ LINE](#line)

---

## 7. เมื่อมีการแก้ไข (หลัง deploy แล้ว)

หลักการ: **แก้บนเครื่อง → ทดสอบ → commit → push → Railway deploy ให้เอง** — ไม่แก้ของบน production ตรงๆ

### 7.1 แก้โค้ด (ขั้นตอนมาตรฐาน)

```bash
git switch main && git pull                 # เอาโค้ดล่าสุด
git switch -c fix-<ชื่องาน>                  # แตก branch ใหม่
# … แก้โค้ด แล้วลองบนเครื่องด้วย pnpm dev …
pnpm lint && pnpm typecheck && pnpm test    # ต้องผ่านทั้งหมด
git add -A && git commit -m "<แก้อะไร>"
git push -u origin fix-<ชื่องาน>
gh pr create --fill                         # เปิด pull request
gh pr checks --watch                        # รอ CI เป็นสีเขียว
gh pr merge --merge --delete-branch         # รวมเข้า main
```

เมื่อ merge เข้า `main` Railway จะ build และ deploy **เฉพาะ service ที่ไฟล์ตรงกับ Watch Paths** ของมัน (เช่นแก้แค่ `apps/web` จะ deploy แค่ web) → ดูสถานะที่แท็บ **Deployments** แล้วทำ smoke test ข้อ 5.7 ซ้ำ

### 7.2 แก้โครงสร้างฐานข้อมูล (schema)

1. แก้ `apps/api/prisma/schema.prisma`
2. สร้าง migration บนเครื่อง (ระบบถามชื่อ migration):

   ```bash
   pnpm db:migrate
   ```

3. commit **ทั้ง schema และโฟลเดอร์ migration ใหม่** ใน `apps/api/prisma/migrations/` แล้วทำตามข้อ 7.1
4. ตอน deploy, Pre-deploy Command (`db:deploy`) จะ apply migration ให้เองก่อนเปิดเวอร์ชันใหม่ ถ้า migration ล้ม deployment จะไม่ถูกเปิดใช้ (เวอร์ชันเดิมยังรันอยู่)

**ห้าม**แก้ไฟล์ migration ที่ขึ้น production ไปแล้ว และ**ห้าม** reset ฐานข้อมูล production — ถ้าจะแก้ ให้สร้าง migration ใหม่ต่อท้ายเสมอ

### 7.3 แก้ prompt หรือกติกาของ AI

แก้ใน `skills/crm-copilot/src/` → เพิ่มเลข `PROMPT_VERSION` ใน `src/prompt.ts` → รัน `pnpm --filter @ai-crm/crm-copilot eval` → ทำตามข้อ 7.1 (Watch Paths ของ api มี `/skills/**` → api deploy ใหม่เอง)

### 7.4 แก้ตัวแปร / secret บน Railway

- แก้ที่ service → **Variables** → กด **Deploy** ที่แถบ staged changes → service นั้น deploy ใหม่พร้อมค่าใหม่
- **`API_URL` ของ web ถูกใช้ตอน build** — แก้แล้วให้ build ใหม่จากโค้ดล่าสุด: เปิด service web → `Cmd + K` → **Deploy Latest Commit**
- เปลี่ยนชื่อ service `api` หรือ `PORT` ของ api → ต้องแก้ `API_URL` ของ web และ build web ใหม่ด้วย

### 7.5 เปลี่ยน secret (เช่นเมื่อสงสัยว่าหลุด)

| secret | ทำอย่างไร | ผลข้างเคียง |
|---|---|---|
| `ANTHROPIC_API_KEY` | สร้าง key ใหม่ → ใส่ใน Railway → Deploy → Delete key เก่าในหน้า API keys | ไม่มี |
| `LINE_CHANNEL_ACCESS_TOKEN` | ออก token ใหม่ในแท็บ Messaging API → ใส่ใน Railway → Deploy | ไม่มี |
| `LINE_CHANNEL_SECRET` | ออกใหม่ในแท็บ Basic settings → ใส่ใน Railway → Deploy **ทันที** | ระหว่างที่ค่าไม่ตรง webhook จะถูกปฏิเสธ (401) |
| `JWT_SECRET` | สร้างใหม่ด้วย `openssl rand -base64 48` → ใส่ใน Railway → Deploy | ทุกคนถูก logout ต้อง login ใหม่ |

### 7.6 ย้อนกลับเวอร์ชัน (rollback)

deploy แล้วพัง → service → แท็บ **Deployments** → จุดสามจุดของ deployment ก่อนหน้าที่ดีอยู่ → **Rollback** (คืนทั้ง image และตัวแปรของเวอร์ชันนั้น)

> rollback **ไม่ย้อนฐานข้อมูล** — ถ้าเวอร์ชันที่พังมี migration ไปแล้ว ต้องแก้ด้วย migration ใหม่ (ข้อ 7.2)

### 7.7 เปลี่ยน domain ของเว็บ

แก้ Webhook URL ใน LINE Developers Console ให้ตรงกับ domain ใหม่ (ข้อ 6.2) แล้วกด Verify

---

## 8. แก้ปัญหาที่พบบ่อย

### บนเครื่อง

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `pnpm: command not found` | ยังไม่ได้ `corepack enable` (ข้อ 1.3) หรือยังไม่ได้เปิด Terminal ใหม่หลังติดตั้ง |
| `pnpm db:up` ขึ้น `Cannot connect to the Docker daemon` | ยังไม่ได้เปิด Docker Desktop — เปิดแล้วรอสักครู่ |
| `pnpm db:up` บอกพอร์ต `5432` ถูกใช้ | มี Postgres ตัวอื่นในเครื่อง — ปิดตัวนั้น หรือเปลี่ยนพอร์ต: `POSTGRES_PORT=5433 pnpm db:up` แล้วแก้ `:5432` เป็น `:5433` ใน `DATABASE_URL` และ `TEST_DATABASE_URL` ของ `apps/api/.env` |
| `pnpm dev` บอกพอร์ต 3000 / 4000 ถูกใช้ | มีระบบเดิมค้างอยู่ — ดูว่าอะไรจับพอร์ต: `lsof -iTCP:4000 -sTCP:LISTEN -n -P` แล้วปิด (`kill <PID>`) |
| `Invalid environment variables: … JWT_SECRET: must be at least 32 characters` | ยังไม่ได้ตั้ง `JWT_SECRET` ใน `apps/api/.env` (ข้อ 2.3) |
| `pnpm db:seed` ขึ้น `Database already has data…` | seed ไปแล้ว ไม่ต้องทำซ้ำ — ถ้าต้องการล้างแล้ว seed ใหม่จริงๆ: `pnpm db:seed -- --reset` (**ข้อมูลเดิมหายหมด**) |
| login ขึ้น "อีเมลหรือรหัสผ่านไม่ถูกต้อง" | รหัสผ่านคือ `SEED_DEMO_PASSWORD` **ตอนที่ seed** — ถ้าเปลี่ยนค่าในไฟล์ภายหลัง รหัสเดิมยังใช้อยู่ (หรือ seed ใหม่ด้วย `--reset`) |
| login แล้วหน้าเว็บค้าง / 500 | ฐานข้อมูลยังไม่ได้เปิด — `pnpm db:up` แล้วดู http://localhost:3000/api/health |
| การ์ด AI ขึ้น "ใช้กติกาสำรอง: ยังไม่ได้ตั้งค่า AI (ไม่มี API key)" | ปกติเมื่อไม่มี key (ข้อ 3) |
| การ์ด AI ขึ้น "ใช้กติกาสำรอง: ติดต่อ AI ไม่ได้" ทั้งที่ health เป็น `"ai":"claude"` | key ผิด / หมดอายุ / เครดิตหมด / เกิน spend limit — log ของ api มี `Claude API error 401` (key ผิด) → ตรวจที่ Console แล้ว restart |
| `pnpm line:simulate` ได้ `401 … INVALID_SIGNATURE` | `LINE_CHANNEL_SECRET` ที่ api ใช้อยู่ไม่ตรงกับในไฟล์ — restart `pnpm dev` หลังแก้ `.env` |
| `pnpm line:simulate` ได้ `503 … SERVICE_UNAVAILABLE` | ยังไม่ได้ตั้ง `LINE_CHANNEL_SECRET` (ข้อ 4) |

### บน Railway

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| build ไม่ใช้ Dockerfile ของเรา / build ผิดวิธี | ขาดตัวแปร `RAILWAY_DOCKERFILE_PATH` (ข้อ 5.4 / 5.5) หรือ Root Directory ไม่ว่าง |
| build ผ่านแต่ start ไม่ขึ้น (หา `pnpm` ไม่เจอ / รันคำสั่ง `pnpm --filter …`) | ยังไม่ได้ลบ Start Command ที่ Railway ใส่ให้ตอนแยก package (ข้อ 5.4 / 5.5) |
| มี service `@ai-crm/crm-copilot` หรือ `@ai-crm/shared` build / deploy ล้ม | ไม่ต้อง deploy — เป็น library ที่อยู่ใน image ของ api / web แล้ว ลบทิ้งได้ (ข้อ 5.4) |
| api deploy ล้มที่ขั้น pre-deploy | ดู log: ต่อฐานข้อมูลไม่ได้ = `DATABASE_URL` อ้างชื่อ service ผิด (ต้องตรงกับชื่อ service ฐานข้อมูล เช่น `${{Postgres.DATABASE_URL}}`) |
| api ขึ้น `Invalid environment variables` ใน Deploy Logs | ตัวแปรขาด / ผิดรูปแบบ — log บอกชื่อตัวแปร (ไม่แสดงค่า) |
| healthcheck ไม่ผ่าน | api: `/api/health` ตอบ 503 เมื่อต่อฐานข้อมูลไม่ได้; web: ต้องมี `PORT=3000` และ Healthcheck Path `/healthz` |
| เว็บเปิดได้แต่ login / ข้อมูลขึ้น error (เรียก `/api/*` ไม่ได้) | `API_URL` ของ web ผิด หรือ service ไม่ได้ชื่อ `api` หรือ api ไม่ได้ใช้ `PORT=4000` → แก้แล้ว **Deploy Latest Commit** ที่ web (ข้อ 7.4) |
| AI ใช้กติกาสำรองตลอด / ส่ง LINE ไม่ออก ทั้งที่ตั้งค่าครบ | บัญชีเป็น Limited Trial (ออกอินเทอร์เน็ตจำกัด) → อัปเกรดแผน (ข้อ 5.3) |
| แก้โค้ดแล้ว service ไม่ deploy ใหม่ | ไฟล์ที่แก้ไม่ตรงกับ Watch Paths ของ service นั้น หรือเปิด Wait for CI แล้ว CI ยังไม่ผ่าน |

<a id="line"></a>

### LINE

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| กด Verify แล้วไม่ Success | URL ผิด (ต้องเป็น `https://<web-domain>/api/webhooks/line`) หรือ api ยังไม่มี `LINE_CHANNEL_SECRET` (ตอบ 503) |
| ส่งข้อความจากมือถือแล้วไม่ขึ้นในระบบ | ยังไม่เปิด **Use webhook** · ดู Deploy Logs ของ api: ไม่มี `line webhook received` = LINE ยังเรียกไม่ถึง, มี `line webhook rejected: invalid signature` = channel secret ไม่ตรง |
| ข้อความเข้าแล้วแต่ OA ตอบเองด้วยข้อความอัตโนมัติ | ยังไม่ได้ปิด Greeting / Auto-reply messages (ท้ายข้อ 4.2) |
| (บนเครื่อง) กด Verify ไม่ Success / ทักแล้วไม่ขึ้น | Terminal ของ `cloudflared` ถูกปิด หรือเปิดใหม่แล้ว URL เปลี่ยน (แก้ Webhook URL ตามข้อ 4.5) · `pnpm dev` ไม่ได้รันอยู่ · ยังไม่ได้ restart หลังแก้ `.env` · ตรวจด้วยการเปิด `https://<คำสุ่ม>.trycloudflare.com/api/health` |
| (บนเครื่อง) `cloudflared` ไม่ขึ้น URL `trycloudflare.com` | มีไฟล์ `~/.cloudflared/config.yaml` อยู่ — เปลี่ยนชื่อไฟล์ชั่วคราวแล้วรันใหม่ |
| (บนเครื่อง) เปิด URL ของ tunnel แล้วเจอ `{"error":{"code":"NOT_FOUND"…}}` | ปกติ — tunnel ชี้ไปที่ api (ไม่ใช่หน้าเว็บ) ใช้หน้าเว็บที่ http://localhost:3000 |
| (บนเครื่อง) อนุมัติแล้ว "ส่งไม่สำเร็จ" กับ lead จาก seed / `line:simulate` | ปกติเมื่อ `LINE_MODE=live` — ผู้ใช้ LINE ของข้อมูลสมมติไม่มีจริง ทดสอบกับ lead ที่เกิดจากการทักด้วยมือถือจริง |
| อนุมัติแล้วข้อความขึ้น "ส่งไม่สำเร็จ" | ข้อความใต้ bubble บอกเหตุผลจาก LINE: `401` = access token ผิด / หมดอายุ, `429` = โควตาข้อความของ OA หมด → แก้แล้วกด **ส่งอีกครั้ง** |
| event จาก LINE ค้าง / ประมวลผลไม่ผ่าน | login เป็น admin แล้วเปิด `https://<web-domain>/api/webhook-events?status=FAILED` ดู `lastError` (ระบบลองซ้ำเองที่ 1 / 5 / 15 / 60 นาที) |

อาการอื่นหรือดูตัวเลขภาพรวม: `docs/monitoring.md` (log ที่ระบบเขียน และตัวเลขที่ควร alert)

---

## 9. เช็กลิสต์ส่งงาน

- [ ] URL ของ repo (private ให้เชิญผู้ประเมิน หรือเปิด public) — ไม่มี secret ในไฟล์และในประวัติ git
- [ ] URL ของเว็บ `https://<web-domain>` + บัญชี demo (`sales01@demo.local` / `admin@demo.local`) + รหัสผ่านจากข้อ 5.6 (ส่งแยกจาก repo)
- [ ] วิธีทดสอบ LINE: ภาพ QR code (ข้อ 6.3) + ขั้นตอนทักแล้วดูในระบบ — webhook ของ OA ตัวนี้ต้องชี้ production (ไม่ใช่ tunnel)
- [ ] วิดีโอ 3–5 นาที (อัดเอง) — ลำดับพร้อมเวลาและจุดที่ควรพูดอยู่ท้าย `docs/demo-guide.md` (คู่มือทดลองใช้ทุกกรณี)
- [ ] ไม่มี secret จริงในเอกสาร วิดีโอ หรือแชต
