import type { ApiErrorCode, ApiErrorResponse } from '@ai-crm/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '../generated/prisma/client';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface FieldIssue {
  path: string;
  message: string;
}

export function validationError(message: string, issues: FieldIssue[]): HttpError {
  return new HttpError(400, 'VALIDATION_ERROR', message, { issues });
}

export function notFound(entity: string): HttpError {
  return new HttpError(404, 'NOT_FOUND', `${entity} not found`);
}

export function isPrismaError(error: unknown, code: 'P2002' | 'P2003' | 'P2025'): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

/** แปลงทุก error เป็นรูปแบบ { error: { code, message, details? } } — 5xx ไม่ส่งรายละเอียดภายในออกไป */
export function createErrorHandler(): ErrorRequestHandler {
  return (err: unknown, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const httpError = toHttpError(err);
    if (!(err instanceof HttpError) && httpError.status >= 500) {
      req.log.error({ err }, 'unhandled error');
    } else if (httpError.status >= 500) {
      // 5xx ที่ตั้งใจตอบ (เช่น LINE webhook ยังไม่ตั้งค่า) — ไม่ใช่ bug
      req.log.warn({ code: httpError.code }, httpError.message);
    }
    const body: ApiErrorResponse = {
      error: {
        code: httpError.code,
        message: httpError.message,
        ...(httpError.details === undefined ? {} : { details: httpError.details }),
      },
    };
    res.status(httpError.status).json(body);
  };
}

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;

  // service จัดการกรณีที่รู้ความหมายเองแล้ว — ตรงนี้เป็นตาข่ายสุดท้าย
  if (isPrismaError(err, 'P2025')) return new HttpError(404, 'NOT_FOUND', 'Record not found');
  if (isPrismaError(err, 'P2002')) {
    return new HttpError(409, 'CONFLICT', 'A record with the same unique value already exists');
  }
  if (isPrismaError(err, 'P2003')) {
    return new HttpError(409, 'CONFLICT', 'The record is referenced by other records');
  }

  // error จาก express.json() มี field `type`
  const type =
    typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string'
      ? err.type
      : undefined;
  if (type === 'entity.parse.failed') {
    return new HttpError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  if (type === 'entity.too.large') {
    return new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }
  return new HttpError(500, 'INTERNAL_ERROR', 'Internal server error');
}
