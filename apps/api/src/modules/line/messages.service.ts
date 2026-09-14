import type { AuthUser, Message, MessageCreateInput } from '@ai-crm/shared';
import { randomUUID } from 'node:crypto';
import { HttpError, notFound } from '../../http/errors';
import { messageSelect, toMessage } from '../mappers';
import { deliverMessage, type OutboundDeps } from './outbound';

function conflict(message: string): HttpError {
  return new HttpError(409, 'CONFLICT', message);
}

async function readMessage(deps: OutboundDeps, id: string): Promise<Message> {
  const row = await deps.prisma.message.findUnique({ where: { id }, select: messageSelect });
  if (!row) throw notFound('Message');
  return toMessage(row);
}

/**
 * คนพิมพ์ตอบลูกค้าทาง LINE เอง: บันทึก QUEUED → ส่ง (retry อัตโนมัติ) → SENT / FAILED
 * ร่างคำตอบของ AI ที่ยังรออยู่กลายเป็น SUPERSEDED เพราะคนตอบไปแล้ว
 */
export async function sendLineMessage(
  deps: OutboundDeps,
  leadId: string,
  input: MessageCreateInput,
  actor: AuthUser,
): Promise<Message> {
  const lead = await deps.prisma.lead.findUnique({
    where: { id: leadId },
    select: { contactId: true, contact: { select: { lineUserId: true } } },
  });
  if (!lead) throw notFound('Lead');
  if (!lead.contact.lineUserId) throw conflict('The contact is not linked to LINE');

  const message = await deps.prisma.$transaction(async (tx) => {
    await tx.aiSuggestion.updateMany({
      where: { leadId, type: 'LINE_REPLY', status: 'PENDING' },
      data: { status: 'SUPERSEDED' },
    });
    return tx.message.create({
      data: {
        leadId,
        contactId: lead.contactId,
        direction: 'OUTBOUND',
        channel: 'LINE',
        status: 'QUEUED',
        text: input.text,
        retryKey: randomUUID(),
        sentById: actor.id,
      },
      select: { id: true },
    });
  });

  deps.logger.info({ leadId, messageId: message.id, actorId: actor.id }, 'line message queued');
  await deliverMessage(deps, message.id);
  return readMessage(deps, message.id);
}

/** ส่งข้อความที่ FAILED ใหม่ด้วย retryKey เดิม → ถ้า LINE เคยรับไปแล้ว ลูกค้าจะไม่ได้ซ้ำ */
export async function retryMessage(
  deps: OutboundDeps,
  messageId: string,
  actor: AuthUser,
): Promise<Message> {
  const { count } = await deps.prisma.message.updateMany({
    where: { id: messageId, direction: 'OUTBOUND', status: 'FAILED' },
    data: { status: 'QUEUED' },
  });
  if (count === 0) {
    await readMessage(deps, messageId); // 404 ถ้าไม่มี
    throw conflict('Only failed outbound messages can be retried');
  }
  deps.logger.info({ messageId, actorId: actor.id }, 'line message retry requested');
  await deliverMessage(deps, messageId);
  return readMessage(deps, messageId);
}
