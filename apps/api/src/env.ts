import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string'),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(8),
  /** จำนวน proxy ที่อยู่หน้า API (local ผ่าน Next = 1, Railway ผ่าน edge + Next = 2) */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),
});

export type Env = z.infer<typeof envSchema>;

/** อ่านและ validate env ตอน start — ผิดแล้วหยุดทันที (บอกแค่ชื่อ key ไม่พิมพ์ค่าเพราะอาจเป็น secret) */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
