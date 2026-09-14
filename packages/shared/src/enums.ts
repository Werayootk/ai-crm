import { z } from 'zod';

// ต้องตรงกับ enum ใน apps/api/prisma/schema.prisma — apps/api มี test คอยตรวจว่าไม่เพี้ยน
// แยกไว้ที่นี่เพราะ web และ skills ห้าม depend on Prisma

export const USER_ROLES = ['ADMIN', 'SALES'] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

export const LEAD_STAGES = ['NEW', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const;
export const leadStageSchema = z.enum(LEAD_STAGES);
export type LeadStage = z.infer<typeof leadStageSchema>;

export const LEAD_SOURCES = ['WEBSITE', 'MANUAL', 'LINE'] as const;
export const leadSourceSchema = z.enum(LEAD_SOURCES);
export type LeadSource = z.infer<typeof leadSourceSchema>;

export const ACTIVITY_TYPES = [
  'NOTE',
  'CALL',
  'MEETING',
  'TASK',
  'STAGE_CHANGE',
  'AI_APPROVED',
  'AI_REJECTED',
  'SYSTEM',
] as const;
export const activityTypeSchema = z.enum(ACTIVITY_TYPES);
export type ActivityType = z.infer<typeof activityTypeSchema>;

/** ประเภทที่ผู้ใช้สร้างเองได้ — ที่เหลือระบบสร้างเท่านั้น (audit trail) */
export const MANUAL_ACTIVITY_TYPES = ['NOTE', 'CALL', 'MEETING', 'TASK'] as const;
export const manualActivityTypeSchema = z.enum(MANUAL_ACTIVITY_TYPES);
export type ManualActivityType = z.infer<typeof manualActivityTypeSchema>;

export const MESSAGE_DIRECTIONS = ['INBOUND', 'OUTBOUND'] as const;
export const messageDirectionSchema = z.enum(MESSAGE_DIRECTIONS);
export type MessageDirection = z.infer<typeof messageDirectionSchema>;

export const MESSAGE_CHANNELS = ['LINE', 'WEB_FORM'] as const;
export const messageChannelSchema = z.enum(MESSAGE_CHANNELS);
export type MessageChannel = z.infer<typeof messageChannelSchema>;

export const MESSAGE_STATUSES = ['RECEIVED', 'QUEUED', 'SENT', 'FAILED'] as const;
export const messageStatusSchema = z.enum(MESSAGE_STATUSES);
export type MessageStatus = z.infer<typeof messageStatusSchema>;

export const AI_SUGGESTION_TYPES = ['QUALIFICATION', 'NEXT_ACTION', 'LINE_REPLY'] as const;
export const aiSuggestionTypeSchema = z.enum(AI_SUGGESTION_TYPES);
export type AiSuggestionType = z.infer<typeof aiSuggestionTypeSchema>;

export const AI_SUGGESTION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED'] as const;
export const aiSuggestionStatusSchema = z.enum(AI_SUGGESTION_STATUSES);
export type AiSuggestionStatus = z.infer<typeof aiSuggestionStatusSchema>;

export const AI_SOURCES = ['LLM', 'FALLBACK'] as const;
export const aiSourceSchema = z.enum(AI_SOURCES);
export type AiSource = z.infer<typeof aiSourceSchema>;

export const WEBHOOK_EVENT_STATUSES = ['RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED'] as const;
export const webhookEventStatusSchema = z.enum(WEBHOOK_EVENT_STATUSES);
export type WebhookEventStatus = z.infer<typeof webhookEventStatusSchema>;
