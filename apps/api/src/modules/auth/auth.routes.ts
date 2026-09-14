import { loginInputSchema, type AuthResponse } from '@ai-crm/shared';
import { Router, type Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../../http/errors';
import { route } from '../../http/route';
import { verifyCredentials } from './auth.service';
import {
  clearSessionCookie,
  setSessionCookie,
  signSessionToken,
  type SessionConfig,
} from './session';

export interface LoginRateLimitConfig {
  windowMs: number;
  /** จำนวนครั้งที่ login พลาดได้ต่อ IP + email ในหนึ่ง window */
  limit: number;
}

function emailFromBody(req: Request): string {
  const body: unknown = req.body;
  if (
    typeof body === 'object' &&
    body !== null &&
    'email' in body &&
    typeof body.email === 'string'
  ) {
    return body.email.trim().toLowerCase();
  }
  return '';
}

export function createAuthRouter(deps: {
  prisma: PrismaClient;
  session: SessionConfig;
  loginRateLimit: LoginRateLimitConfig;
}): Router {
  const { prisma, session } = deps;
  const router = Router();

  // นับเฉพาะครั้งที่พลาด ต่อ IP + email — หลัง proxy ถ้า IP เพี้ยนก็ยังจำกัดราย email ได้
  const loginLimiter = rateLimit({
    windowMs: deps.loginRateLimit.windowMs,
    limit: deps.loginRateLimit.limit,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? 'unknown')}|${emailFromBody(req)}`,
    handler: (_req, _res, next) => {
      next(new HttpError(429, 'RATE_LIMITED', 'Too many failed login attempts. Try again later.'));
    },
  });

  router.post(
    '/auth/login',
    loginLimiter,
    route({ auth: 'public', body: loginInputSchema }, async ({ req, res, body }) => {
      const user = await verifyCredentials(prisma, body.email, body.password);
      if (!user) {
        req.log.warn({ email: body.email }, 'login failed');
        throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid email or password');
      }
      setSessionCookie(res, await signSessionToken(user.id, session), session);
      req.log.info({ userId: user.id }, 'login succeeded');
      res.json({ user } satisfies AuthResponse);
    }),
  );

  router.post(
    '/auth/logout',
    route({ auth: 'user' }, ({ res }) => {
      clearSessionCookie(res, session);
      res.status(204).end();
    }),
  );

  router.get(
    '/auth/me',
    route({ auth: 'user' }, ({ res, user }) => {
      res.json({ user } satisfies AuthResponse);
    }),
  );

  return router;
}
