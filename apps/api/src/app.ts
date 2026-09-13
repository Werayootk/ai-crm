import type { CopilotRunOptions } from '@ai-crm/crm-copilot';
import { randomUUID } from 'node:crypto';
import express, { Router, type Express } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { PrismaClient } from './generated/prisma/client';
import { createErrorHandler, notFoundHandler } from './http/errors';
import { createAiRouter, type AiRateLimitConfig } from './modules/ai/ai.routes';
import { createAuthRouter, type LoginRateLimitConfig } from './modules/auth/auth.routes';
import { createAuthenticate } from './modules/auth/authenticate';
import type { SessionConfig } from './modules/auth/session';
import { createCompaniesRouter } from './modules/companies/companies.routes';
import { createContactsRouter } from './modules/contacts/contacts.routes';
import { createLeadsRouter } from './modules/leads/leads.routes';
import type { LineClient } from './modules/line/line-client';
import { createUsersRouter } from './modules/users/users.routes';
import { createHealthRouter } from './routes/health';

export interface AppConfig {
  session: SessionConfig;
  loginRateLimit: LoginRateLimitConfig;
  aiRateLimit: AiRateLimitConfig;
  trustProxy: number;
}

export interface AppDeps {
  prisma: PrismaClient;
  logger: Logger;
  config: AppConfig;
  /** crm-copilot: provider = null คือไม่มี API key → ใช้กติกาสำรอง */
  copilot: CopilotRunOptions;
  line: LineClient;
  /** ระยะรอก่อน retry การส่ง LINE — test ตั้งเป็น 0 */
  lineRetryDelaysMs?: readonly number[];
}

const REQUEST_ID_PATTERN = /^[\w-]{1,64}$/;

export function createApp(deps: AppDeps): Express {
  const { prisma, logger, config } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
            ? incoming
            : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      // uptime monitor ยิง health ถี่ — ไม่ต้อง log ทุก request
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );

  // Phase 5: LINE webhook ต้อง mount ก่อนบรรทัดนี้ เพราะต้องใช้ raw body ตรวจ signature
  app.use(express.json({ limit: '100kb' }));
  app.use(createAuthenticate(prisma, config.session));

  const aiDeps = {
    prisma,
    logger,
    copilot: deps.copilot,
    line: deps.line,
    ...(deps.lineRetryDelaysMs ? { lineRetryDelaysMs: deps.lineRetryDelaysMs } : {}),
  };

  const api = Router();
  api.use(
    createHealthRouter(prisma, {
      ai: deps.copilot.provider ? 'claude' : 'fallback',
      line: deps.line.mode,
    }),
  );
  api.use(
    createAuthRouter({ prisma, session: config.session, loginRateLimit: config.loginRateLimit }),
  );
  api.use(createUsersRouter(prisma));
  api.use(createCompaniesRouter(prisma));
  api.use(createContactsRouter(prisma));
  api.use(createLeadsRouter(prisma));
  api.use(createAiRouter({ ...aiDeps, rateLimit: config.aiRateLimit }));
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(createErrorHandler());
  return app;
}
