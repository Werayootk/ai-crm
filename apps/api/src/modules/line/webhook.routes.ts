import express, { Router } from 'express';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { HttpError, validationError } from '../../http/errors';
import { route } from '../../http/route';
import { verifyLineSignature } from './signature';
import type { WebhookProcessor } from './webhook-processor';
import { lineEventEnvelopeSchema, lineWebhookBodySchema } from './webhook.schema';

export interface LineWebhookDeps {
  prisma: PrismaClient;
  /** null = ยังไม่ได้ตั้ง LINE_CHANNEL_SECRET → ปิดรับ webhook */
  channelSecret: string | null;
  processor: WebhookProcessor;
}

function parseJson(raw: Buffer): unknown {
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Body is not valid JSON');
  }
}

/**
 * POST /api/webhooks/line — ต้อง mount ก่อน express.json() เพราะต้องตรวจลายเซ็นกับ body ดิบ
 * 1) ตรวจลายเซ็น (ไม่ผ่าน = 401 และไม่บันทึกอะไร) 2) บันทึก event — webhookEventId ซ้ำถูกข้าม
 * 3) ตอบ 200 ทันที 4) ประมวลผลต่อในคิว (map contact / lead, ให้ AI ร่างคำตอบ)
 */
export function createLineWebhookRouter(deps: LineWebhookDeps): Router {
  const router = Router();

  router.post(
    '/webhooks/line',
    express.raw({ type: () => true, limit: '512kb' }),
    route({ auth: 'public' }, async ({ req, res }) => {
      if (!deps.channelSecret) {
        throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'LINE webhook is not configured');
      }
      const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!verifyLineSignature(raw, req.get('x-line-signature'), deps.channelSecret)) {
        req.log.warn({ ip: req.ip }, 'line webhook rejected: invalid signature');
        throw new HttpError(401, 'INVALID_SIGNATURE', 'Invalid LINE signature');
      }

      const body = lineWebhookBodySchema.safeParse(parseJson(raw));
      if (!body.success) throw validationError('Invalid LINE webhook body', []);
      const rows: Prisma.WebhookEventCreateManyInput[] = [];
      for (const [index, event] of body.data.events.entries()) {
        const envelope = lineEventEnvelopeSchema.safeParse(event);
        if (!envelope.success) {
          throw validationError('Invalid LINE webhook event', [
            { path: `events.${index}`, message: envelope.error.issues[0]?.message ?? 'invalid' },
          ]);
        }
        rows.push({
          eventId: envelope.data.webhookEventId,
          type: envelope.data.type,
          lineUserId: envelope.data.source?.userId ?? null,
          payload: event,
          isRedelivery: envelope.data.deliveryContext.isRedelivery,
        });
      }

      // ปุ่ม Verify ใน LINE Console ส่ง events ว่าง — ตอบ 200 เฉยๆ
      const created =
        rows.length === 0
          ? []
          : await deps.prisma.webhookEvent.createManyAndReturn({
              data: rows,
              skipDuplicates: true,
              select: { id: true },
            });
      const duplicates = rows.length - created.length;
      req.log.info({ events: rows.length, duplicates }, 'line webhook received');
      res.json({ received: rows.length, duplicates });

      void deps.processor.enqueue(created.map((event) => event.id));
    }),
  );

  return router;
}
