import type { AuthUser } from '@ai-crm/shared';
import bcrypt from 'bcryptjs';
import { pino } from 'pino';
import request from 'supertest';
import { createApp, type AppConfig } from '../src/app';
import type { PrismaClient, UserRole } from '../src/generated/prisma/client';

export const silentLogger = pino({ level: 'silent' });

export const TEST_PASSWORD = 'correct-horse-battery-staple';

export const testConfig: AppConfig = {
  session: {
    secret: 'test-only-jwt-secret-not-used-anywhere-else',
    ttlSeconds: 3600,
    secureCookies: false,
  },
  loginRateLimit: { windowMs: 60_000, limit: 1_000 },
  trustProxy: 0,
};

export function createTestApp(prisma: PrismaClient, config: Partial<AppConfig> = {}) {
  return createApp({ prisma, logger: silentLogger, config: { ...testConfig, ...config } });
}

// cost 4 = ต่ำสุดของ bcrypt ให้ test เร็ว (production/seed ใช้ 10)
const testPasswordHash = bcrypt.hashSync(TEST_PASSWORD, 4);

let userSequence = 0;

export async function createUser(
  prisma: PrismaClient,
  overrides: { role?: UserRole; isActive?: boolean; name?: string } = {},
): Promise<AuthUser> {
  userSequence += 1;
  return prisma.user.create({
    data: {
      email: `user${userSequence}-${Date.now()}@test.local`,
      name: overrides.name ?? `Test User ${userSequence}`,
      role: overrides.role ?? 'SALES',
      isActive: overrides.isActive ?? true,
      passwordHash: testPasswordHash,
    },
    select: { id: true, email: true, name: true, role: true },
  });
}

/** supertest agent ที่ login แล้ว (เก็บ session cookie ไว้ใช้ request ต่อไป) */
export async function loginAs(app: ReturnType<typeof createTestApp>, user: AuthUser) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/login')
    .send({ email: user.email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`login failed for ${user.email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}
