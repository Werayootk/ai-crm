import { z } from 'zod';
import { blankToNull, emailSchema, optionalText, phoneSchema, requiredText } from './common';

/** POST /api/public/leads — ฟอร์ม "ติดต่อเรา" หน้าเว็บ (ไม่ต้อง login) */
export const publicLeadInputSchema = z.strictObject({
  name: requiredText(200),
  email: emailSchema,
  phone: blankToNull(phoneSchema),
  company: optionalText(200),
  message: requiredText(2_000),
  /** PDPA: ต้องยินยอมให้ทีมขายติดต่อกลับก่อนเก็บข้อมูล (ข้อความนี้ขึ้นในฟอร์มสาธารณะ จึงเป็นภาษาไทย) */
  consent: z.literal(true, 'กรุณายินยอมให้ทีมงานติดต่อกลับก่อนส่ง'),
  /** honeypot: ช่องที่คนมองไม่เห็น — มีค่าแปลว่าเป็นบอต (ตอบเหมือนสำเร็จแต่ไม่บันทึก) */
  website: z.string().max(200).optional(),
});
export type PublicLeadInput = z.infer<typeof publicLeadInputSchema>;

/** ไม่บอก id หรือว่าอีเมลนี้เคยมีในระบบหรือไม่ */
export const publicLeadResponseSchema = z.object({ received: z.literal(true) });
export type PublicLeadResponse = z.infer<typeof publicLeadResponseSchema>;
