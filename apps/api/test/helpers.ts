import { createServer, type Server } from 'node:http';
import type { AuthUser } from '@ai-crm/shared';
import bcrypt from 'bcryptjs';
import { pino } from 'pino';
import request from 'supertest';
import { createApp, type AppConfig, type AppDeps } from '../src/app';
import type { PrismaClient, UserRole } from '../src/generated/prisma/client';
import { createMockLineClient } from '../src/modules/line/mock-line-client';

export const silentLogger = pino({ level: 'silent' });

export const TEST_PASSWORD = 'correct-horse-battery-staple';

export const testConfig: AppConfig = {
  session: {
    secret: 'test-only-jwt-secret-not-used-anywhere-else',
    ttlSeconds: 3600,
    secureCookies: false,
  },
  loginRateLimit: { windowMs: 60_000, limit: 1_000 },
  aiRateLimit: { windowMs: 60_000, limit: 1_000 },
  trustProxy: 0,
};

export type TestApp = Server;

const openServers = new Set<Server>();

/**
 * app ของ test ที่ listen บน 127.0.0.1 แล้ว — supertest จะใช้พอร์ตนี้แทนการ listen(0) เอง
 * เพราะ listen(0) ของ supertest จับ `::` ซึ่งบน macOS อาจได้พอร์ตซ้ำกับโปรแกรมอื่นที่จับ 127.0.0.1 อยู่
 * แล้ว supertest ต่อ 127.0.0.1 ไปเจอโปรแกรมนั้น → test ล้มแบบสุ่มด้วย "Parse Error: Expected HTTP/"
 *
 * default: ไม่มี AI provider (ใช้กติกาสำรอง), LINE จำลอง, retry ไม่รอ
 */
export async function createTestApp(
  prisma: PrismaClient,
  overrides: Partial<AppConfig> & Partial<Pick<AppDeps, 'copilot' | 'line'>> = {},
): Promise<TestApp> {
  const { copilot, line, ...config } = overrides;
  const app = createApp({
    prisma,
    logger: silentLogger,
    config: { ...testConfig, ...config },
    copilot: copilot ?? { provider: null, timeoutMs: 1_000 },
    line: line ?? createMockLineClient(),
    lineRetryDelaysMs: [0, 0],
  });
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  openServers.add(server);
  return server;
}

/** เรียกจาก test/setup.ts หลังจบแต่ละไฟล์ */
export async function closeTestServers(): Promise<void> {
  const servers = [...openServers];
  openServers.clear();
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
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
export async function loginAs(app: TestApp, user: AuthUser) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/login')
    .send({ email: user.email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`login failed for ${user.email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}
