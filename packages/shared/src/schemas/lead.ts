import { z } from 'zod';
import { leadSourceSchema, leadStageSchema } from '../enums';
import {
  entityRefSchema,
  hasAnyField,
  idSchema,
  isoDateTimeSchema,
  listOf,
  optionalText,
  paginationQuerySchema,
  requiredText,
  searchQuerySchema,
} from './common';
import { contactCreateInputSchema, lineLinkSchema } from './contact';

/** มูลค่าดีล (THB) — รับ/ส่งเป็น number, DB เก็บ Decimal(12,2) */
const moneySchema = z.number().nonnegative().max(9_999_999_999.99);
const scoreSchema = z.number().int().min(0).max(100);

/** 'me' = lead ของผู้ใช้ที่ login อยู่, 'unassigned' = ยังไม่มี owner */
export const ownerFilterSchema = z.union([z.literal('me'), z.literal('unassigned'), idSchema]);

// ───────── inputs ─────────

export const leadCreateInputSchema = z
  .object({
    title: requiredText(200),
    value: moneySchema.nullable().optional(),
    score: scoreSchema.nullable().optional(),
    contactId: idSchema.optional(),
    contact: contactCreateInputSchema.optional(),
    /** ไม่ส่ง = ใช้บริษัทของ contact */
    companyId: idSchema.nullable().optional(),
    /** ไม่ส่ง = ผู้สร้างเป็น owner, null = ยังไม่ assign */
    ownerId: idSchema.nullable().optional(),
  })
  .refine((input) => (input.contactId === undefined) !== (input.contact === undefined), {
    message: 'Provide exactly one of contactId or contact',
    path: ['contactId'],
  });
export type LeadCreateInput = z.infer<typeof leadCreateInputSchema>;

/** แก้ข้อมูลทั่วไป — stage แก้ผ่าน PATCH /leads/:id/stage เท่านั้น */
export const leadUpdateInputSchema = z
  .object({
    title: requiredText(200).optional(),
    value: moneySchema.nullable().optional(),
    score: scoreSchema.nullable().optional(),
    summary: optionalText(5_000),
    companyId: idSchema.nullable().optional(),
    ownerId: idSchema.nullable().optional(),
  })
  .refine(hasAnyField, 'At least one field is required');
export type LeadUpdateInput = z.infer<typeof leadUpdateInputSchema>;

/** body ของ PATCH /api/leads/:id/stage — กติกาการย้าย stage อยู่ที่ checkStageChange() */
export const leadStageChangeInputSchema = z.object({
  stage: leadStageSchema,
  lostReason: z.string().trim().min(1).max(500).optional(),
});
export type LeadStageChangeInput = z.infer<typeof leadStageChangeInputSchema>;

export const LEAD_SORT_FIELDS = [
  'updatedAt',
  'createdAt',
  'stageChangedAt',
  'value',
  'score',
] as const;

export const leadListQuerySchema = paginationQuerySchema.extend({
  q: searchQuerySchema,
  stage: listOf(leadStageSchema).optional(),
  source: leadSourceSchema.optional(),
  ownerId: ownerFilterSchema.optional(),
  companyId: idSchema.optional(),
  contactId: idSchema.optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  sort: z.enum(LEAD_SORT_FIELDS).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

export const pipelineQuerySchema = z.object({ ownerId: ownerFilterSchema.optional() });
export type PipelineQuery = z.infer<typeof pipelineQuerySchema>;

// ───────── responses ─────────

export const leadListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  stage: leadStageSchema,
  source: leadSourceSchema,
  value: z.number().nullable(),
  score: z.number().int().nullable(),
  stageChangedAt: isoDateTimeSchema,
  closedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  contact: entityRefSchema,
  company: entityRefSchema.nullable(),
  owner: entityRefSchema.nullable(),
});
export type LeadListItem = z.infer<typeof leadListItemSchema>;

export const leadDetailSchema = leadListItemSchema.extend({
  summary: z.string().nullable(),
  lostReason: z.string().nullable(),
  contact: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    jobTitle: z.string().nullable(),
    line: lineLinkSchema,
  }),
  company: z
    .object({
      id: z.string(),
      name: z.string(),
      domain: z.string().nullable(),
      industry: z.string().nullable(),
    })
    .nullable(),
});
export type LeadDetail = z.infer<typeof leadDetailSchema>;

export const pipelineSummarySchema = z.object({
  stages: z.array(
    z.object({
      stage: leadStageSchema,
      count: z.number().int(),
      totalValue: z.number(),
    }),
  ),
});
export type PipelineSummary = z.infer<typeof pipelineSummarySchema>;
