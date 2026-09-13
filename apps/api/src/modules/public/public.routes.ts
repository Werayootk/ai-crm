import { publicLeadInputSchema, type PublicLeadResponse } from '@ai-crm/shared';
import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../../http/errors';
import { route } from '../../http/route';
import { submitPublicLead } from './public-leads.service';

export interface PublicRateLimitConfig {
  windowMs: number;
  /** จำนวนครั้งที่ส่งฟอร์มได้ต่อ IP ในหนึ่ง window (กันสแปม) */
  limit: number;
}

export function createPublicRouter(deps: {
  prisma: PrismaClient;
  logger: Logger;
  rateLimit: PublicRateLimitConfig;
}): Router {
  const router = Router();

  const limiter = rateLimit({
    windowMs: deps.rateLimit.windowMs,
    limit: deps.rateLimit.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? 'unknown'),
    handler: (_req, _res, next) => {
      next(new HttpError(429, 'RATE_LIMITED', 'Too many submissions — please try again later'));
    },
  });

  router.post(
    '/public/leads',
    limiter,
    route({ auth: 'public', body: publicLeadInputSchema }, async ({ res, body }) => {
      await submitPublicLead(deps, body);
      res.status(201).json({ received: true } satisfies PublicLeadResponse);
    }),
  );

  return router;
}
