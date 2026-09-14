import type { Page } from '@ai-crm/shared';
import { validationError } from './errors';

/** cursor = id ของแถวสุดท้ายในหน้าก่อน (ใช้กับ Prisma cursor pagination) */
export function cursorArgs(cursor: string | undefined): { cursor?: { id: string }; skip?: number } {
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}

/** ดึงมา limit + 1 แถวเพื่อรู้ว่ามีหน้าถัดไปหรือไม่ */
export function toPage<Row extends { id: string }, Item>(
  rows: Row[],
  limit: number,
  total: number,
  map: (row: Row) => Item,
): Page<Item> {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: pageRows.map(map),
    nextCursor: hasMore ? (pageRows.at(-1)?.id ?? null) : null,
    total,
  };
}

export interface TimeCursor {
  createdAt: Date;
  id: string;
}

/** cursor สำหรับรายการที่รวมหลายตาราง เรียงด้วย (createdAt, id) */
export function encodeTimeCursor({ createdAt, id }: TimeCursor): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function decodeTimeCursor(cursor: string): TimeCursor {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const createdAt = new Date(iso ?? '');
  if (!id || Number.isNaN(createdAt.getTime())) {
    throw validationError('Invalid request query', [{ path: 'cursor', message: 'Invalid cursor' }]);
  }
  return { createdAt, id };
}
