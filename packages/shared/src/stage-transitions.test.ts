import { describe, expect, it } from 'vitest';
import { LEAD_STAGES, type LeadStage } from './enums';
import { canTransition, checkStageChange, isOpenStage } from './stage-transitions';

// ตารางคาดหวังทั้งหมด 5x5 — ถ้ากติกาเปลี่ยน ต้องแก้ทั้งตารางนี้และ docs/plans
const EXPECTED: Record<LeadStage, readonly LeadStage[]> = {
  NEW: ['QUALIFIED', 'PROPOSAL', 'LOST'],
  QUALIFIED: ['NEW', 'PROPOSAL', 'LOST'],
  PROPOSAL: ['NEW', 'QUALIFIED', 'WON', 'LOST'],
  WON: [],
  LOST: ['NEW'],
};

describe('canTransition', () => {
  for (const from of LEAD_STAGES) {
    for (const to of LEAD_STAGES) {
      const expected = EXPECTED[from].includes(to);
      it(`${from} → ${to} is ${expected ? 'allowed' : 'rejected'}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});

describe('checkStageChange', () => {
  it('rejects moving to the same stage', () => {
    expect(checkStageChange({ from: 'NEW', to: 'NEW' })).toEqual({
      ok: false,
      error: 'SAME_STAGE',
    });
  });

  it('only allows WON from PROPOSAL', () => {
    expect(checkStageChange({ from: 'QUALIFIED', to: 'WON' })).toEqual({
      ok: false,
      error: 'TRANSITION_NOT_ALLOWED',
    });
    expect(checkStageChange({ from: 'PROPOSAL', to: 'WON' })).toEqual({ ok: true });
  });

  it('treats WON as terminal', () => {
    expect(checkStageChange({ from: 'WON', to: 'NEW' })).toEqual({
      ok: false,
      error: 'TRANSITION_NOT_ALLOWED',
    });
  });

  it('requires a non-blank lostReason when moving to LOST', () => {
    expect(checkStageChange({ from: 'QUALIFIED', to: 'LOST' })).toEqual({
      ok: false,
      error: 'LOST_REASON_REQUIRED',
    });
    expect(checkStageChange({ from: 'QUALIFIED', to: 'LOST', lostReason: '   ' })).toEqual({
      ok: false,
      error: 'LOST_REASON_REQUIRED',
    });
    expect(checkStageChange({ from: 'QUALIFIED', to: 'LOST', lostReason: 'งบไม่พอ' })).toEqual({
      ok: true,
    });
  });

  it('allows reopening a LOST lead as NEW', () => {
    expect(checkStageChange({ from: 'LOST', to: 'NEW' })).toEqual({ ok: true });
  });
});

describe('isOpenStage', () => {
  it('marks only NEW, QUALIFIED and PROPOSAL as open', () => {
    expect(LEAD_STAGES.filter(isOpenStage)).toEqual(['NEW', 'QUALIFIED', 'PROPOSAL']);
  });
});
