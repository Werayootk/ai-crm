import { z } from 'zod';

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_JSON',
  'UNAUTHENTICATED',
  /** webhook ที่ลายเซ็นไม่ถูก */
  'INVALID_SIGNATURE',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  /** ฟีเจอร์ที่ยังไม่ได้ตั้งค่า (เช่น LINE webhook ไม่มี channel secret) */
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** รูปแบบ error เดียวของทุก endpoint */
export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['up', 'down']),
  /** 'claude' = มี API key, 'fallback' = ใช้กติกาสำรองอย่างเดียว */
  ai: z.enum(['claude', 'fallback']),
  /** 'live' = ส่งผ่าน LINE Messaging API จริง, 'mock' = จำลองในหน่วยความจำ */
  line: z.enum(['live', 'mock']),
  uptimeSec: z.number().int().nonnegative(),
  time: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
