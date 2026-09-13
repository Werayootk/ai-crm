import { z } from 'zod';
import { isoDateTimeSchema } from './common';

/** GET /api/ops/summary (admin) — ตัวเลขสำหรับ monitor / alert */
export const opsSummarySchema = z.object({
  /** ช่วงเวลาที่นับสถิติ AI (24 ชม. ล่าสุด) */
  since: isoDateTimeSchema,
  line: z.object({
    /** event ที่ประมวลผลไม่สำเร็จและยังไม่เลิกลอง / เลิกลองแล้ว */
    failedEvents: z.number().int().nonnegative(),
    gaveUpEvents: z.number().int().nonnegative(),
    /** ค้าง RECEIVED เกิน 5 นาที = คิวติด */
    stuckEvents: z.number().int().nonnegative(),
    failedMessages: z.number().int().nonnegative(),
  }),
  ai: z.object({
    /** จำนวนครั้งที่ขอคำแนะนำ (คนกด + ร่างอัตโนมัติจาก LINE) */
    requests: z.number().int().nonnegative(),
    /** สัดส่วนที่ต้องใช้กติกาสำรอง — สูงขึ้นผิดปกติ = AI มีปัญหา (key / timeout / provider) */
    fallbackRate: z.number().min(0).max(1).nullable(),
    /** เวลาตอบเฉลี่ยเฉพาะครั้งที่ Claude ตอบได้ */
    avgLlmLatencyMs: z.number().int().nonnegative().nullable(),
    pendingApprovals: z.number().int().nonnegative(),
  }),
  leads: z.object({
    /** lead ใหม่ที่ยังไม่มีเจ้าของ (จาก LINE / เว็บ) */
    unassignedNew: z.number().int().nonnegative(),
  }),
});
export type OpsSummary = z.infer<typeof opsSummarySchema>;
