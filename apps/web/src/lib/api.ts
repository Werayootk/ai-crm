import { apiErrorResponseSchema, type ApiErrorCode } from '@ai-crm/shared';
import { z } from 'zod';

export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'BAD_RESPONSE',
    message: string,
    readonly issues: FieldIssue[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type QueryValue = string | number | boolean | null | undefined | readonly string[];
export type Query = Record<string, QueryValue>;

/** ค่าว่าง / undefined ถูกตัดทิ้ง, list ต่อด้วย , ตามรูปแบบที่ API รับ */
export function toSearchParams(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object') {
      if (value.length > 0) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

const issuesSchema = z.object({
  issues: z.array(z.object({ path: z.string(), message: z.string() })),
});

async function send(method: string, path: string, body?: unknown, query?: Query) {
  try {
    // เรียกผ่าน origin เดียวกับเว็บ (Next rewrite → API) — browser แนบ session cookie ให้เอง
    return await fetch(`/api${path}${toSearchParams(query)}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง');
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  const parsed = apiErrorResponseSchema.safeParse(await readJson(res));
  if (!parsed.success) {
    return new ApiError(
      res.status,
      'BAD_RESPONSE',
      `เซิร์ฟเวอร์ตอบกลับผิดพลาด (HTTP ${res.status})`,
    );
  }
  const { code, message, details } = parsed.data.error;
  const issues = issuesSchema.safeParse(details);
  return new ApiError(res.status, code, message, issues.success ? issues.data.issues : []);
}

/** ตรวจ response ด้วย schema เดียวกับฝั่ง API — ไม่เชื่อข้อมูลที่ได้จาก network */
async function parseResponse<S extends z.ZodType>(schema: S, res: Response): Promise<z.output<S>> {
  if (!res.ok) throw await toApiError(res);
  const parsed = schema.safeParse(await readJson(res));
  if (!parsed.success) {
    throw new ApiError(res.status, 'BAD_RESPONSE', 'ข้อมูลจากเซิร์ฟเวอร์ไม่ตรงรูปแบบที่คาดไว้');
  }
  return parsed.data;
}

export async function apiGet<S extends z.ZodType>(
  schema: S,
  path: string,
  query?: Query,
): Promise<z.output<S>> {
  return parseResponse(schema, await send('GET', path, undefined, query));
}

export async function apiSend<S extends z.ZodType>(
  schema: S,
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<z.output<S>> {
  return parseResponse(schema, await send(method, path, body));
}

export async function apiSendNoContent(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<void> {
  const res = await send(method, path, body);
  if (!res.ok) throw await toApiError(res);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'เกิดข้อผิดพลาดที่ไม่คาดคิด';
}
