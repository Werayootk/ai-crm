import type { ApiErrorCode, ApiErrorResponse } from '@ai-crm/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';

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
    if (httpError.status >= 500) {
      req.log.error({ err }, 'unhandled error');
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
