import { createClaudeProvider } from '@ai-crm/crm-copilot';
import { config as loadDotenv } from 'dotenv';
import { setTimeout as sleep } from 'node:timers/promises';
import { createApp } from './app';
import { createPrisma } from './db';
import { parseEnv, type Env } from './env';
import { createLogger } from './logger';
import { generateSuggestions } from './modules/ai/suggestions.service';
import { createHttpLineClient } from './modules/line/http-line-client';
import { createMockLineClient } from './modules/line/mock-line-client';
import { createWebhookProcessor, startWebhookRetryWorker } from './modules/line/webhook-processor';

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
// env ตรวจแล้วว่า LINE_MODE=live ต้องมี token
const line =
  env.LINE_MODE === 'live' && env.LINE_CHANNEL_ACCESS_TOKEN
    ? createHttpLineClient({ channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN })
    : createMockLineClient();
const copilot = { provider: copilotProvider, timeoutMs: env.AI_TIMEOUT_MS };

// ข้อความ LINE เข้า → ให้ AI ร่างคำตอบรออนุมัติ (requestedBy = null คือระบบขอเอง)
const webhooks = createWebhookProcessor({
  prisma,
  logger,
  line,
  requestDraft: async (leadId) => {
    await generateSuggestions({ prisma, logger, copilot, line }, leadId, null);
  },
});
const stopRetryWorker = startWebhookRetryWorker(webhooks, logger);

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
  copilot,
  line,
  lineChannelSecret: env.LINE_CHANNEL_SECRET ?? null,
  webhooks,
});

logger.info(
  {
    ai: copilotProvider ? env.AI_MODEL : 'fallback-only',
    line: line.mode,
    lineWebhook: env.LINE_CHANNEL_SECRET ? 'enabled' : 'disabled',
  },
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
  stopRetryWorker();
  server.close(() => {
    // รองานในคิวสักครู่ — ที่ยังไม่เสร็จอยู่ใน DB แล้ว process ถัดไปเก็บไปทำต่อ
    void Promise.race([webhooks.idle(), sleep(10_000)])
      .then(() => prisma.$disconnect())
      .finally(() => process.exit(0));
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
