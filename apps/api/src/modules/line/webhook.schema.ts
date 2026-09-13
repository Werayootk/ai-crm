import { z } from 'zod';

// รูปแบบ webhook ของ LINE (github.com/line/line-openapi → webhook.yml)
// ตรวจแค่ field ที่ระบบใช้ — field อื่นเก็บไว้ครบใน WebhookEvent.payload

/** body ของ request: เก็บ event เป็น JSON ดิบ แล้วค่อยตรวจทีละ event */
export const lineWebhookBodySchema = z.object({
  destination: z.string(),
  events: z.array(z.record(z.string(), z.json())),
});

/** field ที่ทุก event ต้องมี */
export const lineEventEnvelopeSchema = z.object({
  type: z.string().min(1).max(50),
  webhookEventId: z.string().min(1).max(100),
  timestamp: z.number().int().nonnegative(),
  source: z.object({ type: z.string(), userId: z.string().max(100).optional() }).optional(),
  deliveryContext: z.object({ isRedelivery: z.boolean() }),
});

const userSourceSchema = z.object({ type: z.literal('user'), userId: z.string().min(1) });

/** ข้อความจากผู้ใช้ 1:1 (ไม่รับจาก group / room) — text หรือประเภทอื่น (สติกเกอร์ รูป ฯลฯ) */
export const lineUserMessageEventSchema = z.object({
  type: z.literal('message'),
  timestamp: z.number().int().nonnegative(),
  source: userSourceSchema,
  message: z.object({ id: z.string().min(1), type: z.string(), text: z.string().optional() }),
});
export type LineUserMessageEvent = z.infer<typeof lineUserMessageEventSchema>;

/** ผู้ใช้เพิ่ม OA เป็นเพื่อน */
export const lineFollowEventSchema = z.object({
  type: z.literal('follow'),
  source: userSourceSchema,
});
