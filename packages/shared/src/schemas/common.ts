import { z } from 'zod';

export const idSchema = z.string().trim().min(1).max(64);
export const idParamsSchema = z.object({ id: idSchema });

export const isoDateTimeSchema = z.iso.datetime();

/** อ้างอิง entity อื่นแบบย่อ (id + ชื่อที่แสดง) */
export const entityRefSchema = z.object({ id: z.string(), name: z.string() });
export type EntityRef = z.infer<typeof entityRefSchema>;

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** opaque — ส่งค่า nextCursor จากหน้าก่อนกลับมาตามเดิม */
  cursor: z.string().trim().min(1).max(200).optional(),
});

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    total: z.number().int().nonnegative(),
  });
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

/** คำค้น — ค่าว่างถือว่าไม่ได้ค้น */
export const searchQuerySchema = z
  .string()
  .trim()
  .max(100)
  .transform((value) => (value === '' ? undefined : value))
  .optional();

export function requiredText(max: number) {
  return z.string().trim().min(1).max(max);
}

/** field ที่ไม่บังคับ: ส่ง '' (จากฟอร์ม) หรือ null = ล้างค่า, ไม่ส่ง = ไม่เปลี่ยน */
export function blankToNull<T extends z.ZodType>(schema: T) {
  return z
    .preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
      schema.nullable(),
    )
    .optional();
}

export function optionalText(max: number) {
  return blankToNull(z.string().trim().max(max));
}

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 -]{5,19}$/, 'Invalid phone number');

export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    'Invalid domain (e.g. example.co.th)',
  );

/** รับได้ทั้ง ?x=A&x=B และ ?x=A,B */
export function listOf<T extends z.ZodType>(item: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.split(',').map((part) => part.trim()) : value),
    z.array(item).min(1),
  );
}

/** PATCH ต้องมีอย่างน้อย 1 field */
export function hasAnyField(value: object): boolean {
  return Object.values(value).some((field) => field !== undefined);
}
