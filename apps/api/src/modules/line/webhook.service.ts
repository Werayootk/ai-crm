import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma/client';
import { isPrismaError } from '../../http/errors';
import type { LineClient } from './line-client';
import {
  lineFollowEventSchema,
  lineUserMessageEventSchema,
  type LineUserMessageEvent,
} from './webhook.schema';

export interface WebhookServiceDeps {
  prisma: PrismaClient;
  logger: Logger;
  line: LineClient;
}

export interface ProcessResult {
  /** lead ที่ควรให้ AI ร่างคำตอบ (มีข้อความ text ใหม่เข้ามา) */
  draftLeadId: string | null;
}

const NONE: ProcessResult = { draftLeadId: null };
const OPEN_STAGES = ['NEW', 'QUALIFIED', 'PROPOSAL'] as const;

const NON_TEXT_LABEL: Record<string, string> = {
  sticker: 'สติกเกอร์',
  image: 'รูปภาพ',
  video: 'วิดีโอ',
  audio: 'ข้อความเสียง',
  file: 'ไฟล์',
  location: 'ตำแหน่งที่ตั้ง',
};

/**
 * ประมวลผล WebhookEvent ที่บันทึกไว้แล้ว 1 ตัว — เรียกซ้ำได้ (event ที่ PROCESSED / IGNORED แล้วจะข้าม)
 * throw เมื่อทำไม่สำเร็จ → ผู้เรียก (webhook processor) บันทึก FAILED และนัด retry
 */
export async function processWebhookEvent(
  deps: WebhookServiceDeps,
  id: string,
): Promise<ProcessResult> {
  const event = await deps.prisma.webhookEvent.findUnique({
    where: { id },
    select: { id: true, eventId: true, type: true, status: true, payload: true },
  });
  if (!event || event.status === 'PROCESSED' || event.status === 'IGNORED') return NONE;
  const log = deps.logger.child({ webhookEventId: event.eventId, eventType: event.type });

  const message = lineUserMessageEventSchema.safeParse(event.payload);
  if (message.success) return handleUserMessage(deps, event.id, message.data, log);

  const follow = lineFollowEventSchema.safeParse(event.payload);
  if (follow.success) {
    await findOrCreateContact(deps, follow.data.source.userId, log);
    await markDone(deps.prisma, event.id, 'PROCESSED');
    return NONE;
  }

  // unfollow, postback, group/room ฯลฯ — เก็บไว้ดูได้แต่ยังไม่ทำอะไร
  await markDone(deps.prisma, event.id, 'IGNORED', `Unsupported event: ${event.type}`);
  return NONE;
}

async function handleUserMessage(
  deps: WebhookServiceDeps,
  eventRowId: string,
  event: LineUserMessageEvent,
  log: Logger,
): Promise<ProcessResult> {
  const contact = await findOrCreateContact(deps, event.source.userId, log);
  // เวลาที่ลูกค้าส่งจริง — event ที่ถูกส่งซ้ำมาช้ายังเรียงถูกที่ใน timeline
  const sentAt = new Date(event.timestamp);
  const isText = event.message.type === 'text' && event.message.text !== undefined;
  const text = isText
    ? (event.message.text ?? '')
    : `[${NON_TEXT_LABEL[event.message.type] ?? `ข้อความประเภท ${event.message.type}`}]`;

  try {
    const { leadId, createdLead } = await deps.prisma.$transaction(async (tx) => {
      // lead ที่ยังเปิดและเคลื่อนไหวล่าสุดของ contact นี้ — ไม่มีก็สร้างใหม่ (ยังไม่มีเจ้าของ)
      const open = await tx.lead.findFirst({
        where: { contactId: contact.id, stage: { in: [...OPEN_STAGES] } },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      let leadId = open?.id;
      if (!leadId) {
        const lead = await tx.lead.create({
          data: {
            title: `ติดต่อผ่าน LINE — ${contact.name}`,
            source: 'LINE',
            stage: 'NEW',
            contactId: contact.id,
            companyId: contact.companyId,
          },
          select: { id: true },
        });
        leadId = lead.id;
        await tx.activity.create({
          data: {
            leadId,
            type: 'SYSTEM',
            body: 'สร้าง lead จากข้อความ LINE',
            // ก่อนข้อความแรก 1 ms → timeline อ่านเป็น "สร้าง lead" แล้วตามด้วยข้อความ
            createdAt: new Date(sentAt.getTime() - 1),
          },
        });
      }
      await tx.message.create({
        data: {
          leadId,
          contactId: contact.id,
          direction: 'INBOUND',
          channel: 'LINE',
          status: 'RECEIVED',
          text,
          lineMessageId: event.message.id,
          webhookEventId: eventRowId,
          createdAt: sentAt,
        },
      });
      // ดัน lead ขึ้นบนสุดของรายการที่เรียงตามความเคลื่อนไหว
      await tx.lead.update({ where: { id: leadId }, data: { updatedAt: new Date() } });
      await tx.webhookEvent.update({
        where: { id: eventRowId },
        data: doneData('PROCESSED'),
      });
      return { leadId, createdLead: open === null };
    });
    log.info({ leadId, contactId: contact.id, createdLead }, 'line message recorded');
    return { draftLeadId: isText ? leadId : null };
  } catch (error) {
    // กันซ้ำชั้นที่ 2: message id เดียวกันมากับ event id อื่น → บันทึกไปแล้ว ไม่ต้องทำอีก
    if (isPrismaError(error, 'P2002')) {
      const existing = await deps.prisma.message.findUnique({
        where: { lineMessageId: event.message.id },
        select: { id: true },
      });
      if (existing) {
        await markDone(deps.prisma, eventRowId, 'IGNORED', 'Duplicate LINE message');
        log.info({ lineMessageId: event.message.id }, 'duplicate line message ignored');
        return NONE;
      }
    }
    throw error;
  }
}

/** LINE user → Contact แบบ 1:1 (lineUserId unique) — ดึงชื่อจากโปรไฟล์ LINE ครั้งแรกที่เจอ */
async function findOrCreateContact(deps: WebhookServiceDeps, userId: string, log: Logger) {
  const select = { id: true, name: true, companyId: true } as const;
  const existing = await deps.prisma.contact.findUnique({ where: { lineUserId: userId }, select });
  if (existing) return existing;

  // โปรไฟล์ดึงไม่ได้ (LINE ล่ม / ผู้ใช้บล็อก) ก็ยังต้องบันทึกข้อความ → ใช้ชื่อชั่วคราว
  // (ขึ้นต้น "ลูกค้า" เพื่อให้คำทักทายของกติกาสำรองอ่านเป็น "สวัสดีคุณลูกค้า")
  const profile = await deps.line.getProfile(userId).catch((error: unknown) => {
    log.warn({ err: error }, 'line profile unavailable — using a placeholder name');
    return null;
  });
  const contact = await deps.prisma.contact.upsert({
    where: { lineUserId: userId },
    create: {
      name: profile?.displayName ?? `ลูกค้า LINE …${userId.slice(-4)}`,
      lineUserId: userId,
      lineDisplayName: profile?.displayName ?? null,
    },
    update: {},
    select,
  });
  log.info({ contactId: contact.id }, 'contact created from line user');
  return contact;
}

function doneData(status: 'PROCESSED' | 'IGNORED', note?: string) {
  return {
    status,
    processedAt: new Date(),
    attempts: { increment: 1 },
    lastError: note ?? null,
    nextRetryAt: null,
  };
}

async function markDone(
  prisma: PrismaClient,
  id: string,
  status: 'PROCESSED' | 'IGNORED',
  note?: string,
): Promise<void> {
  await prisma.webhookEvent.update({ where: { id }, data: doneData(status, note) });
}
