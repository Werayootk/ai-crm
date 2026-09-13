/**
 * Seed ข้อมูลสังเคราะห์ (synthetic) สำหรับ dev/demo — ห้ามใส่ข้อมูลลูกค้าจริง
 * - 20 users (admin 1 + sales 19), 150 companies, 2,000 contacts
 * - 300 active leads (NEW/QUALIFIED/PROPOSAL) + 150 closed (WON/LOST) พร้อม activity timeline และข้อความ
 *
 * ใช้ faker seed คงที่ → รันซ้ำได้ข้อมูลและ id ชุดเดิม (วันที่อิงเวลาปัจจุบัน)
 * ถ้า DB มีข้อมูลอยู่แล้วต้องสั่ง `pnpm db:seed -- --reset` ซึ่งจะล้างข้อมูลเดิมทั้งหมด
 */
import {
  canTransition,
  LEAD_STAGES,
  OPEN_LEAD_STAGES,
  type LeadSource,
  type LeadStage,
} from '@ai-crm/shared';
import { fakerTH as faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { createPrisma } from '../src/db';
import type { Prisma } from '../src/generated/prisma/client';

loadDotenv({ quiet: true });

const SEED = 20260913;
const DAY_MS = 86_400_000;
const SALES_USERS = 19;
const COMPANIES = 150;
const CONTACTS = 2_000;
const LEADS_PER_STAGE: Record<LeadStage, number> = {
  NEW: 110,
  QUALIFIED: 100,
  PROPOSAL: 90,
  WON: 70,
  LOST: 80,
};

// ───────── คลังคำสำหรับสร้างข้อมูล (สังเคราะห์ทั้งหมด) ─────────

const COMPANY_PREFIXES = [
  ['สยาม', 'siam'],
  ['ไทย', 'thai'],
  ['กรุงเทพ', 'krungthep'],
  ['เอเชีย', 'asia'],
  ['โกลบอล', 'global'],
  ['สมาร์ท', 'smart'],
  ['ดิจิทัล', 'digital'],
  ['พรีเมียร์', 'premier'],
  ['นครา', 'nakhara'],
  ['ศรีสุข', 'srisuk'],
  ['รุ่งเรือง', 'rungruang'],
  ['เจริญ', 'charoen'],
  ['อินโนเวท', 'innovate'],
  ['ยูไนเต็ด', 'united'],
  ['แปซิฟิก', 'pacific'],
] as const;

const COMPANY_SUFFIXES = [
  ['เทรดดิ้ง', 'trading', 'Retail'],
  ['อินดัสทรี', 'industry', 'Manufacturing'],
  ['โลจิสติกส์', 'logistics', 'Logistics'],
  ['รีเทล', 'retail', 'Retail'],
  ['เฮลท์แคร์', 'healthcare', 'Healthcare'],
  ['เอ็ดดูเคชั่น', 'education', 'Education'],
  ['พร็อพเพอร์ตี้', 'property', 'Real Estate'],
  ['ฟู้ดส์', 'foods', 'Food & Beverage'],
  ['เทคโนโลยี', 'technology', 'Technology'],
  ['มีเดีย', 'media', 'Media'],
  ['แคปปิตอล', 'capital', 'Finance'],
  ['ฮอสพิทาลิตี้', 'hospitality', 'Hospitality'],
] as const;

const JOB_TITLES = [
  'ผู้จัดการฝ่ายการตลาด',
  'ผู้อำนวยการฝ่ายขาย',
  'เจ้าของกิจการ',
  'ผู้จัดการฝ่ายไอที',
  'Head of Digital',
  'Marketing Manager',
  'ผู้จัดการทั่วไป',
  'เจ้าหน้าที่จัดซื้อ',
  'CMO',
  'ผู้ช่วยผู้จัดการฝ่ายบริหาร',
];

const SERVICES = [
  'ปรับปรุงเว็บไซต์องค์กร',
  'พัฒนา Mobile App',
  'แคมเปญ Digital Marketing',
  'เชื่อมต่อระบบ CRM',
  'AI Chatbot สำหรับบริการลูกค้า',
  'Data Dashboard ผู้บริหาร',
  'แพลตฟอร์ม E-commerce',
  'วางกลยุทธ์แบรนด์',
  'ตั้งค่า LINE OA และ Rich Menu',
  'Marketing Automation',
];

const LOST_REASONS = [
  'งบประมาณไม่พอในปีนี้',
  'เลือกผู้ให้บริการรายอื่น',
  'โปรเจกต์ถูกเลื่อนออกไป',
  'ติดต่อลูกค้าไม่ได้หลายครั้ง',
  'ความต้องการไม่ตรงกับบริการของเรา',
];

const NOTES = [
  'ลูกค้าต้องการเห็นตัวอย่างผลงานในอุตสาหกรรมเดียวกันก่อนตัดสินใจ',
  'ผู้มีอำนาจตัดสินใจคือฝ่ายบริหาร ต้องนัดนำเสนออีกรอบ',
  'ลูกค้ามีระบบเดิมอยู่แล้ว ต้องประเมินการย้ายข้อมูล',
  'งบประมาณยังไม่อนุมัติ คาดว่ารู้ผลปลายเดือน',
  'ลูกค้าเน้นเรื่อง timeline มากกว่าราคา',
];

const CALLS = [
  'โทรคุยเบื้องต้น ลูกค้าสนใจและขอข้อมูลเพิ่มเติมทางอีเมล',
  'โทรติดตามใบเสนอราคา ลูกค้ากำลังพิจารณา',
  'โทรไม่ติด ฝากข้อความไว้',
  'คุยรายละเอียด scope งาน ลูกค้าต้องการแบ่งเป็น 2 phase',
];

const MEETINGS = [
  'ประชุม online นำเสนอแนวทางและตัวอย่างผลงาน',
  'ประชุมที่ออฟฟิศลูกค้า เก็บ requirement กับทีมการตลาด',
  'workshop สั้นๆ เพื่อสรุปเป้าหมายของโปรเจกต์',
];

const TASKS = [
  'ส่งใบเสนอราคาฉบับแก้ไข',
  'ส่งตัวอย่างผลงาน (case study) ให้ลูกค้า',
  'นัดประชุมนำเสนอกับฝ่ายบริหาร',
  'โทรติดตามผลการพิจารณา',
];

const LINE_INBOUND = [
  'สวัสดีครับ สนใจบริการ{service} อยากทราบรายละเอียดเพิ่มเติมครับ',
  'รบกวนขอใบเสนอราคาเบื้องต้นได้ไหมคะ',
  'ตอนนี้ทีมเรากำลังเปรียบเทียบผู้ให้บริการอยู่ 2-3 เจ้าครับ',
  'งบประมาณประมาณ {budget} บาท พอทำได้ไหมครับ',
  'สะดวกคุยผ่าน Zoom วันพฤหัสนี้ไหมคะ',
  'มีตัวอย่างผลงานที่เคยทำให้ธุรกิจแบบเดียวกันไหมคะ',
  'ต้องการให้เริ่มงานได้ภายในไตรมาสหน้าครับ',
  'ขอบคุณครับ เดี๋ยวขอปรึกษาหัวหน้าก่อนนะครับ',
];

const LINE_OUTBOUND = [
  'สวัสดีครับ ขอบคุณที่ติดต่อเข้ามานะครับ ขอทราบเป้าหมายของโปรเจกต์คร่าวๆ ได้ไหมครับ',
  'ได้เลยครับ เดี๋ยวทีมงานเตรียมใบเสนอราคาเบื้องต้นส่งให้ภายในวันพรุ่งนี้ครับ',
  'สะดวกครับ ขอส่งลิงก์นัดประชุมให้ทางอีเมลนะครับ',
  'แนบตัวอย่างผลงานที่ใกล้เคียงให้ดูก่อนนะครับ มีคำถามสอบถามได้ตลอดครับ',
  'รับทราบครับ ถ้ามีข้อมูลเพิ่มเติมแจ้งทางนี้ได้เลยครับ',
];

// ───────── helpers ─────────

function fill(template: string, service: string): string {
  const budget = faker.number.int({ min: 5, max: 200 }) * 10_000;
  return template.replace('{service}', service).replace('{budget}', budget.toLocaleString('en-US'));
}

function between(from: Date, to: Date): Date {
  return to <= from ? from : faker.date.between({ from, to });
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

const FORWARD_PATH: readonly LeadStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'WON'];

/** ลำดับ stage ที่ lead ผ่านมาจนถึง stage ปัจจุบัน — ตรวจกับกติกาใน shared ทุกขั้น */
function stagePath(final: LeadStage): LeadStage[] {
  const path =
    final === 'LOST'
      ? [...stagePath(faker.helpers.arrayElement(OPEN_LEAD_STAGES)), final]
      : FORWARD_PATH.slice(0, FORWARD_PATH.indexOf(final) + 1);
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    if (!from || !to || !canTransition(from, to)) {
      throw new Error(`seed bug: invalid stage path ${path.join(' → ')}`);
    }
  }
  return path;
}

function scoreFor(stage: LeadStage): number | null {
  switch (stage) {
    case 'NEW':
      return faker.datatype.boolean({ probability: 0.6 })
        ? null
        : faker.number.int({ min: 10, max: 45 });
    case 'QUALIFIED':
      return faker.number.int({ min: 40, max: 75 });
    case 'PROPOSAL':
      return faker.number.int({ min: 55, max: 90 });
    case 'WON':
      return faker.number.int({ min: 75, max: 100 });
    case 'LOST':
      return faker.number.int({ min: 5, max: 40 });
  }
}

function sourceLabel(source: LeadSource): string {
  return { WEBSITE: 'ฟอร์มหน้าเว็บไซต์', MANUAL: 'การบันทึกโดยทีมขาย', LINE: 'LINE OA' }[source];
}

async function insertInChunks<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += 1_000) {
    await insert(rows.slice(i, i + 1_000));
  }
}

// ───────── main ─────────

async function main(): Promise<void> {
  const envResult = z
    .object({
      NODE_ENV: z.string().optional(),
      DATABASE_URL: z.string().min(1),
      SEED_DEMO_PASSWORD: z.string().min(12, 'must be at least 12 characters'),
      ALLOW_PRODUCTION_SEED: z.string().optional(),
    })
    .safeParse(process.env);
  if (!envResult.success) {
    const keys = envResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid seed environment — ${keys}`);
  }
  const env = envResult.data;
  if (env.NODE_ENV === 'production' && env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error(
      'Refusing to seed with NODE_ENV=production (set ALLOW_PRODUCTION_SEED=true for the demo DB)',
    );
  }

  const prisma = createPrisma(env.DATABASE_URL);
  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0 && !process.argv.includes('--reset')) {
      console.error(
        'Database already has data. Re-run with `pnpm db:seed -- --reset` to WIPE it and seed again.',
      );
      process.exitCode = 1;
      return;
    }

    faker.seed(SEED);
    const now = new Date();
    const passwordHash = await bcrypt.hash(env.SEED_DEMO_PASSWORD, 10);

    // users
    const admin = {
      id: faker.string.uuid(),
      email: 'admin@demo.local',
      name: 'ผู้ดูแลระบบ (Demo)',
      role: 'ADMIN' as const,
      passwordHash,
    };
    const salesUsers = Array.from({ length: SALES_USERS }, (_, i) => ({
      id: faker.string.uuid(),
      email: `sales${String(i + 1).padStart(2, '0')}@demo.local`,
      name: faker.person.fullName(),
      role: 'SALES' as const,
      passwordHash,
    }));
    const users: Prisma.UserCreateManyInput[] = [admin, ...salesUsers];
    const salesIds = salesUsers.map((u) => u.id);

    // companies: ชื่อไทย + domain อังกฤษที่สอดคล้องกัน (.example เป็น TLD สำหรับตัวอย่างโดยเฉพาะ)
    const combos = faker.helpers
      .shuffle(COMPANY_PREFIXES.flatMap((p) => COMPANY_SUFFIXES.map((s) => [p, s] as const)))
      .slice(0, COMPANIES);
    const companies: Prisma.CompanyCreateManyInput[] = combos.map(
      ([[prefixTh, prefixEn], [suffixTh, suffixEn, industry]]) => ({
        id: faker.string.uuid(),
        name: `บริษัท ${prefixTh}${suffixTh} จำกัด`,
        domain: `${prefixEn}${suffixEn}.example`,
        industry,
        employeeCount: faker.number.int({ min: 5, max: 5_000 }),
      }),
    );

    // contacts: 75% อยู่ในบริษัท, 25% ผูก LINE แล้ว
    const contacts = Array.from({ length: CONTACTS }, (_, i) => {
      const company = faker.datatype.boolean({ probability: 0.75 })
        ? faker.helpers.arrayElement(companies)
        : undefined;
      const hasLine = faker.datatype.boolean({ probability: 0.25 });
      return {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: `contact${String(i + 1).padStart(4, '0')}@${company?.domain ?? 'mail.example'}`,
        phone: `0${faker.helpers.arrayElement(['6', '8', '9'])}${faker.string.numeric(8)}`,
        jobTitle: faker.helpers.arrayElement(JOB_TITLES),
        lineUserId: hasLine
          ? `U${faker.string.hexadecimal({ length: 32, casing: 'lower', prefix: '' })}`
          : null,
        lineDisplayName: hasLine ? faker.person.firstName() : null,
        companyId: company?.id ?? null,
        companyName: company?.name,
      };
    });
    const lineContacts = contacts.filter((c) => c.lineUserId !== null);

    // leads + timeline
    const leads: Prisma.LeadCreateManyInput[] = [];
    const activities: Prisma.ActivityCreateManyInput[] = [];
    const messages: Prisma.MessageCreateManyInput[] = [];

    for (const stage of LEAD_STAGES) {
      for (let n = 0; n < LEADS_PER_STAGE[stage]; n++) {
        const source = faker.helpers.weightedArrayElement<LeadSource>([
          { value: 'WEBSITE', weight: 40 },
          { value: 'MANUAL', weight: 35 },
          { value: 'LINE', weight: 25 },
        ]);
        const contact = faker.helpers.arrayElement(source === 'LINE' ? lineContacts : contacts);
        const service = faker.helpers.arrayElement(SERVICES);
        const ownerId =
          source === 'LINE' && stage === 'NEW' && faker.datatype.boolean()
            ? null
            : faker.helpers.arrayElement(salesIds);
        const actorId = ownerId ?? faker.helpers.arrayElement(salesIds);

        const createdAt = new Date(now.getTime() - faker.number.int({ min: 3, max: 180 }) * DAY_MS);
        const path = stagePath(stage);
        // เวลาที่เข้าแต่ละ stage เรียงจากเก่าไปใหม่ ปิดท้ายไม่เกิน 12 ชม. ก่อนตอนนี้
        const stageTimes: Date[] = [createdAt];
        for (let i = 1; i < path.length; i++) {
          const prev = stageTimes[i - 1] ?? createdAt;
          stageTimes.push(between(addMinutes(prev, 60), new Date(now.getTime() - DAY_MS / 2)));
        }
        const stageChangedAt = stageTimes.at(-1) ?? createdAt;
        const closed = stage === 'WON' || stage === 'LOST';
        const activeUntil = closed ? stageChangedAt : now;
        const lostReason = stage === 'LOST' ? faker.helpers.arrayElement(LOST_REASONS) : null;

        const leadId = faker.string.uuid();
        let lastEventAt = stageChangedAt;
        const track = (date: Date): Date => {
          if (date > lastEventAt) lastEventAt = date;
          return date;
        };

        // activity: lead ถูกสร้าง
        activities.push({
          id: faker.string.uuid(),
          leadId,
          type: 'SYSTEM',
          body: `สร้าง lead จาก${sourceLabel(source)}`,
          actorId: source === 'MANUAL' ? actorId : null,
          createdAt,
        });

        // activity: ประวัติการย้าย stage
        for (let i = 1; i < path.length; i++) {
          const to = path[i];
          activities.push({
            id: faker.string.uuid(),
            leadId,
            type: 'STAGE_CHANGE',
            metadata: { from: path[i - 1], to, ...(to === 'LOST' ? { lostReason } : {}) },
            actorId,
            createdAt: stageTimes[i] ?? createdAt,
          });
        }

        // activity: note / call / meeting (lead ที่ยังไม่มี owner ยังไม่มีใครติดต่อ)
        if (ownerId !== null) {
          for (let i = 0; i < faker.number.int({ min: 1, max: 3 }); i++) {
            const type = faker.helpers.arrayElement(['NOTE', 'CALL', 'MEETING'] as const);
            const pool = type === 'NOTE' ? NOTES : type === 'CALL' ? CALLS : MEETINGS;
            activities.push({
              id: faker.string.uuid(),
              leadId,
              type,
              body: faker.helpers.arrayElement(pool),
              actorId,
              createdAt: track(between(addMinutes(createdAt, 30), activeUntil)),
            });
          }
          if (!closed && faker.datatype.boolean()) {
            activities.push({
              id: faker.string.uuid(),
              leadId,
              type: 'TASK',
              body: faker.helpers.arrayElement(TASKS),
              dueAt: new Date(now.getTime() + faker.number.int({ min: 1, max: 14 }) * DAY_MS),
              actorId,
              createdAt: track(between(addMinutes(createdAt, 30), now)),
            });
          }
        }

        // messages
        if (source === 'LINE') {
          // lead ที่ยังไม่มี owner = ลูกค้าทักมาแล้วยังไม่มีใครตอบ
          const unanswered = ownerId === null;
          const total = faker.number.int(unanswered ? { min: 1, max: 2 } : { min: 2, max: 6 });
          let at = addMinutes(createdAt, faker.number.int({ min: 1, max: 30 }));
          for (let i = 0; i < total && at <= activeUntil; i++) {
            const inbound = unanswered || i % 2 === 0;
            messages.push({
              id: faker.string.uuid(),
              leadId,
              contactId: contact.id,
              direction: inbound ? 'INBOUND' : 'OUTBOUND',
              channel: 'LINE',
              status: inbound ? 'RECEIVED' : 'SENT',
              text: fill(
                faker.helpers.arrayElement(inbound ? LINE_INBOUND : LINE_OUTBOUND),
                service,
              ),
              lineMessageId: inbound ? faker.string.numeric(18) : null,
              retryKey: inbound ? null : faker.string.uuid(),
              attempts: inbound ? 0 : 1,
              sentAt: inbound ? null : at,
              sentById: inbound ? null : actorId,
              createdAt: track(at),
            });
            at = addMinutes(at, faker.number.int({ min: 5, max: 60 * 24 }));
          }
        } else if (source === 'WEBSITE') {
          messages.push({
            id: faker.string.uuid(),
            leadId,
            contactId: contact.id,
            direction: 'INBOUND',
            channel: 'WEB_FORM',
            status: 'RECEIVED',
            text: `สนใจ${service}สำหรับ${contact.companyName ?? 'ธุรกิจของเรา'} รบกวนติดต่อกลับด้วยค่ะ`,
            createdAt,
          });
        }

        leads.push({
          id: leadId,
          title: `${service} — ${contact.companyName ?? contact.name}`,
          stage,
          source,
          value: faker.number.int({ min: 30, max: 3_000 }) * 1_000,
          score: scoreFor(stage),
          lostReason,
          stageChangedAt,
          closedAt: closed ? stageChangedAt : null,
          contactId: contact.id,
          companyId: contact.companyId,
          ownerId,
          createdAt,
          updatedAt: lastEventAt,
        });
      }
    }

    await prisma.$transaction(
      async (tx) => {
        if (existingUsers > 0) {
          console.warn('--reset: wiping existing data');
          await tx.$executeRaw`TRUNCATE TABLE "Message", "AiSuggestion", "Activity", "Lead", "Contact", "Company", "User", "WebhookEvent" CASCADE`;
        }
        await tx.user.createMany({ data: users });
        await tx.company.createMany({ data: companies });
        await insertInChunks(
          contacts.map(({ companyName, ...contact }) => contact),
          (chunk) => tx.contact.createMany({ data: chunk }),
        );
        await tx.lead.createMany({ data: leads });
        await insertInChunks(activities, (chunk) => tx.activity.createMany({ data: chunk }));
        await insertInChunks(messages, (chunk) => tx.message.createMany({ data: chunk }));
      },
      { timeout: 60_000 },
    );

    console.info(
      `Seeded ${users.length} users, ${companies.length} companies, ${contacts.length} contacts, ` +
        `${leads.length} leads, ${activities.length} activities, ${messages.length} messages.`,
    );
    console.info('Demo logins: admin@demo.local, sales01@demo.local … sales19@demo.local');
    console.info('Password: the SEED_DEMO_PASSWORD value in apps/api/.env');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
