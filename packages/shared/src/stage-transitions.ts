import type { LeadStage } from './enums';

/** stage ที่ lead ยังไม่ปิดการขาย */
export const OPEN_LEAD_STAGES = [
  'NEW',
  'QUALIFIED',
  'PROPOSAL',
] as const satisfies readonly LeadStage[];

/**
 * กติกาการย้าย stage
 * - stage ที่ยังเปิดย้ายไป stage เปิดอื่น หรือไป LOST ได้
 * - WON มาจาก PROPOSAL เท่านั้น และเป็นสถานะสุดท้าย
 * - LOST reopen กลับเป็น NEW ได้
 */
const TRANSITIONS: Record<LeadStage, readonly LeadStage[]> = {
  NEW: ['QUALIFIED', 'PROPOSAL', 'LOST'],
  QUALIFIED: ['NEW', 'PROPOSAL', 'LOST'],
  PROPOSAL: ['NEW', 'QUALIFIED', 'WON', 'LOST'],
  WON: [],
  LOST: ['NEW'],
};

export function isOpenStage(stage: LeadStage): boolean {
  return (OPEN_LEAD_STAGES as readonly LeadStage[]).includes(stage);
}

export function allowedTransitions(from: LeadStage): readonly LeadStage[] {
  return TRANSITIONS[from];
}

export function canTransition(from: LeadStage, to: LeadStage): boolean {
  return TRANSITIONS[from].includes(to);
}

export type StageChangeError = 'SAME_STAGE' | 'TRANSITION_NOT_ALLOWED' | 'LOST_REASON_REQUIRED';

export type StageChangeCheck = { ok: true } | { ok: false; error: StageChangeError };

export function checkStageChange(input: {
  from: LeadStage;
  to: LeadStage;
  lostReason?: string | null;
}): StageChangeCheck {
  if (input.from === input.to) return { ok: false, error: 'SAME_STAGE' };
  if (!canTransition(input.from, input.to)) return { ok: false, error: 'TRANSITION_NOT_ALLOWED' };
  if (input.to === 'LOST' && !input.lostReason?.trim()) {
    return { ok: false, error: 'LOST_REASON_REQUIRED' };
  }
  return { ok: true };
}
