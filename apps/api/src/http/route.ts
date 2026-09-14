import type { AuthUser } from '@ai-crm/shared';
import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { HttpError, validationError } from './errors';

/** ทุก endpoint ต้องประกาศระดับสิทธิ์เองเสมอ — ไม่มีค่า default */
type AuthLevel = 'public' | 'user' | 'admin';

interface RouteSchemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

type Parsed<T> = T extends z.ZodType ? z.output<T> : undefined;

export interface RouteContext<S extends RouteSchemas, A extends AuthLevel> {
  req: Request;
  res: Response;
  params: Parsed<S['params']>;
  query: Parsed<S['query']>;
  body: Parsed<S['body']>;
  user: A extends 'public' ? AuthUser | undefined : AuthUser;
}

/**
 * ห่อ handler ให้: ตรวจสิทธิ์ → validate params/query/body ด้วย zod → เรียก handler ด้วยค่าที่ parse แล้ว
 * (Express 5 ส่ง error จาก async handler ต่อให้ error handler เอง)
 */
export function route<A extends AuthLevel, S extends RouteSchemas>(
  config: { auth: A } & S,
  handler: (ctx: RouteContext<S, A>) => Promise<void> | void,
): RequestHandler {
  return async (req, res) => {
    const user = res.locals.user;
    if (config.auth !== 'public' && !user) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Login required');
    }
    if (config.auth === 'admin' && user?.role !== 'ADMIN') {
      throw new HttpError(403, 'FORBIDDEN', 'Admin role required');
    }

    const ctx = {
      req,
      res,
      user,
      params: parsePart(config.params, req.params, 'params'),
      query: parsePart(config.query, req.query, 'query'),
      body: parsePart(config.body, req.body, 'body'),
    };
    // TypeScript พิสูจน์ conditional type ของ ctx เองไม่ได้ — ค่าข้างบนตรวจครบตาม config แล้ว
    await handler(ctx as RouteContext<S, A>);
  };
}

function parsePart(schema: z.ZodType | undefined, value: unknown, part: string): unknown {
  if (!schema) return undefined;
  const result = schema.safeParse(value);
  if (!result.success) {
    throw validationError(
      `Invalid request ${part}`,
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}
