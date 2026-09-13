import { z } from 'zod';
import {
  blankToNull,
  emailSchema,
  entityRefSchema,
  hasAnyField,
  idSchema,
  isoDateTimeSchema,
  optionalText,
  paginationQuerySchema,
  phoneSchema,
  requiredText,
  searchQuerySchema,
} from './common';

// lineUserId ตั้งได้จาก LINE webhook เท่านั้น — ไม่อยู่ใน input
const contactFields = {
  name: requiredText(200),
  email: blankToNull(emailSchema),
  phone: blankToNull(phoneSchema),
  jobTitle: optionalText(100),
  companyId: idSchema.nullable().optional(),
};

export const contactCreateInputSchema = z.object(contactFields);
export type ContactCreateInput = z.infer<typeof contactCreateInputSchema>;

export const contactUpdateInputSchema = z
  .object(contactFields)
  .partial()
  .refine(hasAnyField, 'At least one field is required');
export type ContactUpdateInput = z.infer<typeof contactUpdateInputSchema>;

export const contactListQuerySchema = paginationQuerySchema.extend({
  q: searchQuerySchema,
  companyId: idSchema.optional(),
  hasLine: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export type ContactListQuery = z.infer<typeof contactListQuerySchema>;

/** ไม่เปิดเผย LINE userId ดิบให้ฝั่งเว็บ — บอกแค่ว่าผูกแล้วหรือยัง */
export const lineLinkSchema = z.object({
  linked: z.boolean(),
  displayName: z.string().nullable(),
});

export const contactSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  jobTitle: z.string().nullable(),
  company: entityRefSchema.nullable(),
  line: lineLinkSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Contact = z.infer<typeof contactSchema>;
