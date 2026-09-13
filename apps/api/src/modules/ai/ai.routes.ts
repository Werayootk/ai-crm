import {
  aiSuggestionApproveInputSchema,
  aiSuggestionListQuerySchema,
  aiSuggestionRejectInputSchema,
  idParamsSchema,
  type AiSuggestionList,
} from '@ai-crm/shared';
import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { HttpError } from '../../http/errors';
import { route } from '../../http/route';
import {
  approveSuggestion,
  generateSuggestions,
  listSuggestions,
  rejectSuggestion,
  type AiDeps,
} from './suggestions.service';

export interface AiRateLimitConfig {
  windowMs: number;
  /** จำนวนครั้งที่ขอคำแนะนำจาก AI ได้ต่อผู้ใช้ในหนึ่ง window (คุมค่าใช้จ่าย) */
  limit: number;
}

export function createAiRouter(deps: AiDeps & { rateLimit: AiRateLimitConfig }): Router {
  const router = Router();

  const askLimiter = rateLimit({
    windowMs: deps.rateLimit.windowMs,
    limit: deps.rateLimit.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req, res) => res.locals.user?.id ?? ipKeyGenerator(req.ip ?? 'unknown'),
    handler: (_req, _res, next) => {
      next(
        new HttpError(429, 'RATE_LIMITED', 'Too many AI requests — wait a minute and try again'),
      );
    },
  });

  router.post(
    '/leads/:id/ai-suggestions',
    askLimiter,
    route({ auth: 'user', params: idParamsSchema }, async ({ res, params, user }) => {
      const items = await generateSuggestions(deps, params.id, user);
      res.status(201).json({ items } satisfies AiSuggestionList);
    }),
  );

  router.get(
    '/leads/:id/ai-suggestions',
    route(
      { auth: 'user', params: idParamsSchema, query: aiSuggestionListQuerySchema },
      async ({ res, params, query }) => {
        const items = await listSuggestions(deps.prisma, params.id, query.status);
        res.json({ items } satisfies AiSuggestionList);
      },
    ),
  );

  router.post(
    '/ai-suggestions/:id/approve',
    route(
      { auth: 'user', params: idParamsSchema, body: aiSuggestionApproveInputSchema },
      async ({ res, params, body, user }) => {
        res.json(await approveSuggestion(deps, params.id, body, user));
      },
    ),
  );

  router.post(
    '/ai-suggestions/:id/reject',
    route(
      { auth: 'user', params: idParamsSchema, body: aiSuggestionRejectInputSchema },
      async ({ res, params, body, user }) => {
        res.json(await rejectSuggestion(deps, params.id, body, user));
      },
    ),
  );

  return router;
}
