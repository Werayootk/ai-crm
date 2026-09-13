import { createClaudeProvider } from '@ai-crm/crm-copilot';
import { config as loadDotenv } from 'dotenv';
import { createApp } from './app';
import { createPrisma } from './db';
import { parseEnv, type Env } from './env';
import { createLogger } from './logger';
import { createMockLineClient } from './modules/line/mock-line-client';

// production (Railway) ตั้ง env ให้แล้ว — .env ใช้แค่ตอน dev และไม่ทับค่าที่มีอยู่
loadDotenv({ quiet: true });

let env: Env;
try {
  env = parseEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const logger = createLogger(env);
const prisma = createPrisma(env.DATABASE_URL);

// ไม่มี key = ไม่เรียก Claude เลย ใช้กติกาสำรอง (ไม่พึ่ง credential อื่นที่ SDK อาจหาเจอเอง)
const copilotProvider = env.ANTHROPIC_API_KEY
  ? createClaudeProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.AI_MODEL,
      effort: env.AI_EFFORT,
    })
  : null;
// Phase 5 เพิ่ม LINE_MODE=live
const line = createMockLineClient();

const app = createApp({
  prisma,
  logger,
  config: {
    session: {
      secret: env.JWT_SECRET,
      ttlSeconds: env.SESSION_TTL_HOURS * 3600,
      secureCookies: env.NODE_ENV === 'production',
    },
    loginRateLimit: { windowMs: 15 * 60_000, limit: 10 },
    aiRateLimit: { windowMs: 60_000, limit: 20 },
    trustProxy: env.TRUST_PROXY,
  },
  copilot: { provider: copilotProvider, timeoutMs: env.AI_TIMEOUT_MS },
  line,
});

logger.info(
  { ai: copilotProvider ? env.AI_MODEL : 'fallback-only', line: line.mode },
  'integrations configured',
);

const server = app.listen(env.PORT, (error) => {
  if (error) {
    logger.fatal({ err: error }, 'failed to start api');
    process.exit(1);
  }
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'api listening');
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
