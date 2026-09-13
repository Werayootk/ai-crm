import { z } from 'zod';
import { leadStageSchema } from '../enums';

/** body ของ PATCH /api/leads/:id/stage — กติกาการย้าย stage อยู่ที่ checkStageChange() */
export const leadStageChangeInputSchema = z.object({
  stage: leadStageSchema,
  lostReason: z.string().trim().min(1).max(500).optional(),
});
export type LeadStageChangeInput = z.infer<typeof leadStageChangeInputSchema>;
