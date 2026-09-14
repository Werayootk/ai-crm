import type { WebhookEvent, WebhookEventListQuery } from '@ai-crm/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { HttpError, notFound } from '../../http/errors';
import type { WebhookProcessor } from './webhook-processor';

// admin: ดูสถานะ event จาก LINE และสั่งประมวลผลซ้ำ — payload ดิบ / lineUserId ไม่ส่งออก

const webhookEventSelect = {
  id: true,
  eventId: true,
  type: true,
  status: true,
  isRedelivery: true,
  attempts: true,
  lastError: true,
  nextRetryAt: true,
  processedAt: true,
  receivedAt: true,
  message: { select: { leadId: true } },
} satisfies Prisma.WebhookEventSelect;

function toWebhookEvent(
  row: Prisma.WebhookEventGetPayload<{ select: typeof webhookEventSelect }>,
): WebhookEvent {
  return {
    id: row.id,
    eventId: row.eventId,
    type: row.type,
    status: row.status,
    isRedelivery: row.isRedelivery,
    attempts: row.attempts,
    lastError: row.lastError,
    nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
    processedAt: row.processedAt?.toISOString() ?? null,
    receivedAt: row.receivedAt.toISOString(),
    leadId: row.message?.leadId ?? null,
  };
}

export async function listWebhookEvents(
  prisma: PrismaClient,
  query: WebhookEventListQuery,
): Promise<WebhookEvent[]> {
  const rows = await prisma.webhookEvent.findMany({
    where: query.status ? { status: query.status } : {},
    orderBy: { receivedAt: 'desc' },
    take: query.limit,
    select: webhookEventSelect,
  });
  return rows.map(toWebhookEvent);
}

/** ประมวลผล event ที่ FAILED (หรือค้าง RECEIVED) ใหม่ทันที แล้วคืนสถานะล่าสุด */
export async function retryWebhookEvent(
  prisma: PrismaClient,
  processor: WebhookProcessor,
  id: string,
): Promise<WebhookEvent> {
  const event = await prisma.webhookEvent.findUnique({ where: { id }, select: { status: true } });
  if (!event) throw notFound('Webhook event');
  if (event.status !== 'FAILED' && event.status !== 'RECEIVED') {
    throw new HttpError(409, 'CONFLICT', `This event is already ${event.status}`);
  }
  await processor.enqueue([id]);
  const row = await prisma.webhookEvent.findUniqueOrThrow({
    where: { id },
    select: webhookEventSelect,
  });
  return toWebhookEvent(row);
}
