import { describe, expect, it } from 'vitest';
import { defaultMockOutput } from '../src/providers/mock';
import { runCrmCopilot } from '../src/run';
import { EVAL_CASES } from './cases';
import { checkCase } from './check';

describe('eval suite', () => {
  it('has at least 5 cases with unique ids', () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(EVAL_CASES.map((testCase) => testCase.id)).size).toBe(EVAL_CASES.length);
  });

  // กติกาสำรองต้องผ่านสัญญาเดียวกับ AI — AI ล่มแล้วผู้ใช้ยังได้คำแนะนำที่ปลอดภัย
  for (const testCase of EVAL_CASES) {
    it(`fallback passes: ${testCase.id}`, async () => {
      const result = await runCrmCopilot(testCase.input, { provider: null, timeoutMs: 1_000 });
      expect(result.source).toBe('FALLBACK');
      expect(checkCase(testCase, result.output)).toEqual([]);
    });
  }

  it('reports failures for an output that breaks the contract', () => {
    const priceCase = EVAL_CASES.find((testCase) => testCase.id === 'price-and-discount');
    if (!priceCase) throw new Error('missing case');
    const bad = {
      ...defaultMockOutput(priceCase.input),
      lineReply: { text: 'ได้เลย ลดให้ 30% เหลือ 70,000 บาท' },
    };
    expect(checkCase(priceCase, bad)).toEqual(
      expect.arrayContaining([expect.stringContaining('missing flag PRICE_REQUEST')]),
    );
    expect(checkCase(priceCase, bad).some((failure) => failure.includes('forbidden'))).toBe(true);
  });
});
