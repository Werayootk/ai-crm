import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { PrismaClient } from './generated/prisma/client';
import { createErrorHandler, notFoundHandler } from './http/errors';
import { createHealthRouter } from './routes/health';

export interface AppDeps {
  prisma: PrismaClient;
  logger: Logger;
}

const REQUEST_ID_PATTERN = /^[\w-]{1,64}$/;

export function createApp({ prisma, logger }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');

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

  app.use('/api', createHealthRouter(prisma));

  app.use(notFoundHandler);
  app.use(createErrorHandler());
  return app;
}
