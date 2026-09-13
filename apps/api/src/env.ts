import { z } from 'zod';

/** secret ที่ไม่บังคับ: ค่าว่างถือว่าไม่ได้ตั้ง */
const optionalSecret = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .default('info'),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string'),
    JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(8),
    /** จำนวน proxy ที่อยู่หน้า API (local ผ่าน Next = 1, Railway ผ่าน edge + Next = 2) */
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),

    // ---- AI (crm-copilot) — ไม่มี key = ใช้กติกาสำรองอย่างเดียว ----
    ANTHROPIC_API_KEY: optionalSecret,
    AI_MODEL: z.string().min(1).default('claude-sonnet-5'),
    AI_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(25_000),

    // ---- LINE ----
    /** mock = ส่งออกแบบจำลอง (ไม่ถึงลูกค้า), live = ส่งผ่าน Messaging API จริง */
    LINE_MODE: z.enum(['mock', 'live']).default('mock'),
    /** ตรวจลายเซ็น webhook — ไม่ตั้ง = ปิดรับ webhook (ตอบ 503) */
    LINE_CHANNEL_SECRET: optionalSecret,
    /** ใช้ส่งข้อความ / อ่านโปรไฟล์ — จำเป็นเมื่อ LINE_MODE=live */
    LINE_CHANNEL_ACCESS_TOKEN: optionalSecret,
  })
  .superRefine((env, ctx) => {
    if (env.LINE_MODE !== 'live') return;
    for (const key of ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN'] as const) {
      if (!env[key])
        ctx.addIssue({ code: 'custom', path: [key], message: 'required when LINE_MODE=live' });
    }
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
