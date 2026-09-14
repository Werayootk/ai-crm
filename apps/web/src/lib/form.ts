import { z } from 'zod';
import { th } from 'zod/v4/locales';
import { ApiError } from './api';

// ข้อความ error ของ zod เป็นภาษาไทย (schema เดียวกับฝั่ง API จาก packages/shared)
z.config(th());

/** field path (เช่น "contact.email") → ข้อความ error แรกของ field นั้น */
export type FieldErrors = Record<string, string>;

export function issuesToFieldErrors(
  issues: readonly { path: string | readonly PropertyKey[]; message: string }[],
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const path = typeof issue.path === 'string' ? issue.path : issue.path.map(String).join('.');
    errors[path || '_form'] ??= issue.message;
  }
  return errors;
}

/** validate ด้วย schema ของ shared ก่อนส่ง — ผลลัพธ์ error ใช้ path แบบเดียวกับ API */
export function validate<S extends z.ZodType>(
  schema: S,
  value: unknown,
): { ok: true; data: z.output<S> } | { ok: false; errors: FieldErrors } {
  const result = schema.safeParse(value);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, errors: issuesToFieldErrors(result.error.issues) };
}

/** error 400 จาก API ที่บอก field → แสดงใต้ field; อย่างอื่นคืน null ให้แสดงเป็น toast */
export function apiFieldErrors(error: unknown): FieldErrors | null {
  if (error instanceof ApiError && error.issues.length > 0) {
    return issuesToFieldErrors(error.issues);
  }
  return null;
}

/** ช่องตัวเลขในฟอร์ม: ว่าง = null, อย่างอื่นแปลงเป็น number (NaN ให้ schema แจ้ง error) */
export function numberOrNull(value: string): number | null {
  return value.trim() === '' ? null : Number(value.replaceAll(',', ''));
}
