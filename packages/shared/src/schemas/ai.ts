import { z } from 'zod';
import {
  activityTypeSchema,
  aiSourceSchema,
  aiSuggestionStatusSchema,
  leadSourceSchema,
  leadStageSchema,
  messageChannelSchema,
  messageDirectionSchema,
  type AiSuggestionType,
} from '../enums';
import { entityRefSchema, isoDateTimeSchema, optionalText, requiredText } from './common';
import { messageSchema } from './timeline';

// ───────── สัญญาระหว่าง API ↔ crm-copilot skill ─────────

/** สัญญาณที่ skill แนบมากับคำแนะนำ — แสดงเป็นคำเตือนให้คนที่อนุมัติเห็น */
export const COPILOT_FLAGS = [
  'PROMPT_INJECTION_SUSPECTED',
  'PRICE_REQUEST',
  'MISSING_INFO',
  'NEGATIVE_SENTIMENT',
  'REPLY_REPLACED_BY_GUARDRAIL',
] as const;
export const copilotFlagSchema = z.enum(COPILOT_FLAGS);
export type CopilotFlag = z.infer<typeof copilotFlagSchema>;

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;

/**
 * context ที่ส่งให้ AI — ตัด PII ที่ไม่จำเป็นออก (ไม่มี email, เบอร์โทร, LINE userId)
 * ข้อความจากลูกค้าเป็นข้อมูลที่เชื่อไม่ได้ (อาจมี prompt injection)
 */
export const copilotInputSchema = z.object({
  now: isoDateTimeSchema,
  lead: z.object({
    title: z.string(),
    stage: leadStageSchema,
    source: leadSourceSchema,
    value: z.number().nullable(),
    confirmedScore: z.number().int().nullable(),
    daysInStage: z.number().int().nonnegative(),
    ageDays: z.number().int().nonnegative(),
    hasOwner: z.boolean(),
  }),
  contact: z.object({
    name: z.string(),
    jobTitle: z.string().nullable(),
    hasLine: z.boolean(),
  }),
  company: z
    .object({
      name: z.string(),
      industry: z.string().nullable(),
      employeeCount: z.number().int().nullable(),
    })
    .nullable(),
  /** เก่า → ใหม่ */
  activities: z.array(
    z.object({ type: activityTypeSchema, body: z.string().nullable(), at: isoDateTimeSchema }),
  ),
  /** เก่า → ใหม่ */
  messages: z.array(
    z.object({
      direction: messageDirectionSchema,
      channel: messageChannelSchema,
      text: z.string(),
      at: isoDateTimeSchema,
    }),
  ),
});
export type CopilotInput = z.infer<typeof copilotInputSchema>;

/** ผลลัพธ์ที่ AI ต้องคืน (structured output) — ตรวจซ้ำด้วย schema นี้ทุกครั้ง */
export const copilotOutputSchema = z.object({
  summary: z.string().min(1).max(1200),
  qualification: z.object({
    score: z.number().int().min(0).max(100),
    reasons: z.array(z.string().min(1).max(300)).min(1).max(5),
    confidence: z.enum(CONFIDENCE_LEVELS),
  }),
  nextBestAction: z.object({
    action: z.string().min(1).max(300),
    dueInDays: z.number().int().min(0).max(30),
    rationale: z.string().min(1).max(500),
  }),
  /** null เมื่อ contact ไม่ได้ผูก LINE หรือยังไม่ควรตอบ */
  lineReply: z.object({ text: z.string().min(1).max(1000) }).nullable(),
  flags: z.array(copilotFlagSchema).max(5),
});
export type CopilotOutput = z.infer<typeof copilotOutputSchema>;

// ───────── payload ของ AiSuggestion แต่ละประเภท ─────────

export const qualificationPayloadSchema = z.object({
  summary: z.string(),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string()),
  confidence: z.enum(CONFIDENCE_LEVELS),
  flags: z.array(copilotFlagSchema),
});
export const nextActionPayloadSchema = z.object({
  action: z.string(),
  dueInDays: z.number().int().min(0),
  rationale: z.string(),
});
export const lineReplyPayloadSchema = z.object({
  text: z.string(),
  flags: z.array(copilotFlagSchema),
});

export const SUGGESTION_PAYLOAD_SCHEMAS = {
  QUALIFICATION: qualificationPayloadSchema,
  NEXT_ACTION: nextActionPayloadSchema,
  LINE_REPLY: lineReplyPayloadSchema,
} as const satisfies Record<AiSuggestionType, z.ZodType>;

/** สิ่งที่คนอนุมัติจริง (อาจแก้จากที่ AI เสนอ) */
export const SUGGESTION_FINAL_SCHEMAS = {
  QUALIFICATION: z.object({ score: z.number().int().min(0).max(100), summary: z.string() }),
  NEXT_ACTION: z.object({ action: z.string(), dueAt: isoDateTimeSchema }),
  LINE_REPLY: z.object({ text: z.string() }),
} as const satisfies Record<AiSuggestionType, z.ZodType>;

// ───────── DTO ─────────

const suggestionBase = {
  id: z.string(),
  status: aiSuggestionStatusSchema,
  source: aiSourceSchema,
  aiModel: z.string().nullable(),
  promptVersion: z.string(),
  fallbackReason: z.string().nullable(),
  latencyMs: z.number().int().nullable(),
  createdAt: isoDateTimeSchema,
  requestedBy: entityRefSchema.nullable(),
  reviewedBy: entityRefSchema.nullable(),
  reviewedAt: isoDateTimeSchema.nullable(),
  rejectReason: z.string().nullable(),
};

export const aiSuggestionSchema = z.discriminatedUnion('type', [
  z.object({
    ...suggestionBase,
    type: z.literal('QUALIFICATION'),
    payload: qualificationPayloadSchema,
    finalPayload: SUGGESTION_FINAL_SCHEMAS.QUALIFICATION.nullable(),
  }),
  z.object({
    ...suggestionBase,
    type: z.literal('NEXT_ACTION'),
    payload: nextActionPayloadSchema,
    finalPayload: SUGGESTION_FINAL_SCHEMAS.NEXT_ACTION.nullable(),
  }),
  z.object({
    ...suggestionBase,
    type: z.literal('LINE_REPLY'),
    payload: lineReplyPayloadSchema,
    finalPayload: SUGGESTION_FINAL_SCHEMAS.LINE_REPLY.nullable(),
  }),
]);
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;

export const aiSuggestionListSchema = z.object({ items: z.array(aiSuggestionSchema) });
export type AiSuggestionList = z.infer<typeof aiSuggestionListSchema>;

export const aiSuggestionListQuerySchema = z.object({
  status: aiSuggestionStatusSchema.optional(),
});

// ───────── approve / reject ─────────

/** แก้ค่าได้ก่อนอนุมัติ — แต่ละประเภทใช้ได้เฉพาะ field ของตัวเอง (ดู APPROVE_FIELDS) */
export const aiSuggestionApproveInputSchema = z
  .object({
    score: z.number().int().min(0).max(100).optional(),
    summary: requiredText(1200).optional(),
    action: requiredText(300).optional(),
    dueAt: isoDateTimeSchema.optional(),
    text: requiredText(1000).optional(),
  })
  .strict();
export type AiSuggestionApproveInput = z.infer<typeof aiSuggestionApproveInputSchema>;

export const APPROVE_FIELDS: Record<AiSuggestionType, readonly (keyof AiSuggestionApproveInput)[]> =
  {
    QUALIFICATION: ['score', 'summary'],
    NEXT_ACTION: ['action', 'dueAt'],
    LINE_REPLY: ['text'],
  };

export const aiSuggestionRejectInputSchema = z.object({ reason: optionalText(500) }).strict();
export type AiSuggestionRejectInput = z.infer<typeof aiSuggestionRejectInputSchema>;

/** ผลของการตัดสินใจ — LINE_REPLY แนบข้อความที่ส่งออกไป (SENT หรือ FAILED) */
export const aiSuggestionDecisionSchema = z.object({
  suggestion: aiSuggestionSchema,
  message: messageSchema.nullable(),
});
export type AiSuggestionDecision = z.infer<typeof aiSuggestionDecisionSchema>;
