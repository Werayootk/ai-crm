import { z } from 'zod';
import {
  activityTypeSchema,
  manualActivityTypeSchema,
  messageChannelSchema,
  messageDirectionSchema,
  messageStatusSchema,
} from '../enums';
import { entityRefSchema, isoDateTimeSchema, pageSchema, requiredText } from './common';

export const activityCreateInputSchema = z
  .object({
    type: manualActivityTypeSchema,
    body: requiredText(2_000),
    dueAt: isoDateTimeSchema.optional(),
  })
  .refine((input) => input.dueAt === undefined || input.type === 'TASK', {
    message: 'dueAt is only allowed for TASK',
    path: ['dueAt'],
  });
export type ActivityCreateInput = z.infer<typeof activityCreateInputSchema>;

export const activitySchema = z.object({
  id: z.string(),
  type: activityTypeSchema,
  body: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  dueAt: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  actor: entityRefSchema.nullable(),
});
export type Activity = z.infer<typeof activitySchema>;

export const messageSchema = z.object({
  id: z.string(),
  direction: messageDirectionSchema,
  channel: messageChannelSchema,
  status: messageStatusSchema,
  text: z.string(),
  sentAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  sentBy: entityRefSchema.nullable(),
  /** ส่งจาก AI draft ที่คน approve แล้ว */
  fromAiSuggestion: z.boolean(),
});
export type Message = z.infer<typeof messageSchema>;

export const timelineItemSchema = z.discriminatedUnion('kind', [
  activitySchema.extend({ kind: z.literal('activity') }),
  messageSchema.extend({ kind: z.literal('message') }),
]);
export type TimelineItem = z.infer<typeof timelineItemSchema>;

export const timelinePageSchema = pageSchema(timelineItemSchema);
