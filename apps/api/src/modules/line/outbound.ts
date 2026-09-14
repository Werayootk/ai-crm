import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma/client';
import { LineApiError, type LineClient } from './line-client';

export interface OutboundDeps {
  prisma: PrismaClient;
  line: LineClient;
  logger: Logger;
  /** ระยะรอก่อนลองซ้ำแต่ละรอบ (ms) — test ตั้งเป็น 0 */
  retryDelaysMs?: readonly number[];
}

const DEFAULT_RETRY_DELAYS_MS = [500, 2_000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ส่ง Message (OUTBOUND, QUEUED หรือ FAILED) ออกทาง LINE แล้วบันทึกผล — ไม่ throw
 * - ใช้ retryKey เดิมทุกครั้ง → retry ไม่ทำให้ลูกค้าได้ข้อความซ้ำ
 * - ลองซ้ำเฉพาะ error ที่ลองแล้วมีโอกาสสำเร็จ (network / 5xx / 429) สูงสุด 3 ครั้ง
 * - ล้มหมด → FAILED พร้อม lastError ให้คนกด retry เองได้ภายหลัง
 */
export async function deliverMessage(deps: OutboundDeps, messageId: string): Promise<void> {
  const message = await deps.prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      text: true,
      status: true,
      direction: true,
      retryKey: true,
      attempts: true,
      contact: { select: { lineUserId: true } },
    },
  });
  if (!message || message.direction !== 'OUTBOUND' || message.status === 'SENT') return;
  const log = deps.logger.child({ messageId });

  if (!message.retryKey || !message.contact.lineUserId) {
    await deps.prisma.message.update({
      where: { id: messageId },
      data: { status: 'FAILED', lastError: 'Contact is not linked to LINE' },
    });
    return;
  }

  const delays = deps.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  let attempts = message.attempts;
  let lastError = 'unknown error';
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    attempts += 1;
    try {
      await deps.line.pushText(message.contact.lineUserId, message.text, message.retryKey);
      await deps.prisma.message.update({
        where: { id: messageId },
        data: { status: 'SENT', sentAt: new Date(), attempts, lastError: null },
      });
      log.info({ attempts, lineMode: deps.line.mode }, 'line message sent');
      return;
    } catch (error) {
      const retryable = error instanceof LineApiError ? error.retryable : true;
      lastError = error instanceof Error ? error.message : String(error);
      log.warn({ attempts, retryable, err: error }, 'line push failed');
      const delay = delays[attempt];
      if (!retryable || delay === undefined) break;
      await sleep(delay);
    }
  }
  await deps.prisma.message.update({
    where: { id: messageId },
    data: { status: 'FAILED', attempts, lastError: lastError.slice(0, 500) },
  });
}
