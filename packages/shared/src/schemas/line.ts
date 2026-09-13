import { z } from 'zod';
import { webhookEventStatusSchema } from '../enums';
import { isoDateTimeSchema, requiredText } from './common';

/** เพดานความยาวข้อความที่คนพิมพ์ส่งทาง LINE — ค่าที่เราเลือกเอง (แชตควรสั้น) ไม่ใช่ขีดจำกัดของ LINE */
export const LINE_TEXT_MAX = 2_000;

/** POST /api/leads/:id/messages — คนพิมพ์ตอบลูกค้าเอง */
export const messageCreateInputSchema = z.strictObject({ text: requiredText(LINE_TEXT_MAX) });
export type MessageCreateInput = z.infer<typeof messageCreateInputSchema>;

// ───────── webhook events (admin: ดู / สั่งประมวลผลซ้ำ) ─────────

export const webhookEventSchema = z.object({
  id: z.string(),
  /** webhookEventId ของ LINE */
  eventId: z.string(),
  type: z.string(),
  status: webhookEventStatusSchema,
  isRedelivery: z.boolean(),
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  nextRetryAt: isoDateTimeSchema.nullable(),
  processedAt: isoDateTimeSchema.nullable(),
  receivedAt: isoDateTimeSchema,
  /** lead ที่ข้อความของ event นี้ไปลง (ถ้ามี) */
  leadId: z.string().nullable(),
});
export type WebhookEvent = z.infer<typeof webhookEventSchema>;

export const webhookEventListQuerySchema = z.object({
  status: webhookEventStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type WebhookEventListQuery = z.infer<typeof webhookEventListQuerySchema>;

export const webhookEventListSchema = z.object({ items: z.array(webhookEventSchema) });
export type WebhookEventList = z.infer<typeof webhookEventListSchema>;
