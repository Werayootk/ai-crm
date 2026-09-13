import type { CopilotInput, CopilotOutput } from '@ai-crm/shared';
import { CopilotProviderError, type CopilotProvider } from '../provider';

/** พฤติกรรมจำลองสำหรับ test — ครอบคลุมทุกทางที่ AI จริงล้มได้ */
export type MockBehavior =
  | { kind: 'success'; output?: (input: CopilotInput) => unknown }
  | { kind: 'hang' }
  | { kind: 'error' }
  | { kind: 'refusal' }
  | { kind: 'invalid' };

export function defaultMockOutput(input: CopilotInput): CopilotOutput {
  return {
    summary: `ลูกค้า ${input.contact.name} สนใจ ${input.lead.title} และตอบกลับสม่ำเสมอ`,
    qualification: {
      score: input.lead.stage === 'PROPOSAL' ? 78 : 55,
      reasons: ['มีความต้องการชัดเจน', 'ตอบข้อความเร็ว'],
      confidence: 'medium',
    },
    nextBestAction: {
      action: 'นัดประชุมเพื่อสรุปขอบเขตงาน',
      dueInDays: 2,
      rationale: 'ลูกค้าพร้อมคุยรายละเอียด',
    },
    lineReply: input.contact.hasLine
      ? { text: 'ขอบคุณสำหรับข้อมูล ทีมงานขอนัดประชุมสั้นๆ เพื่อสรุปขอบเขตงานในสัปดาห์นี้ได้ไหม' }
      : null,
    flags: [],
  };
}

export function createMockProvider(
  behavior: MockBehavior = { kind: 'success' },
): CopilotProvider & { calls: CopilotInput[] } {
  const calls: CopilotInput[] = [];
  return {
    name: 'mock',
    model: 'mock-model',
    calls,
    generate(input, signal) {
      calls.push(input);
      switch (behavior.kind) {
        case 'success':
          return Promise.resolve({
            output: behavior.output ? behavior.output(input) : defaultMockOutput(input),
            usage: { inputTokens: 1_000, outputTokens: 300 },
          });
        case 'hang':
          // ไม่ตอบจนกว่าจะถูกยกเลิกด้วย timeout
          return new Promise((_, reject) => {
            signal.addEventListener('abort', () =>
              reject(new CopilotProviderError('timeout', 'aborted')),
            );
          });
        case 'error':
          return Promise.reject(new CopilotProviderError('provider_error', 'Claude API error 529'));
        case 'refusal':
          return Promise.reject(new CopilotProviderError('refusal', 'Claude declined to answer'));
        case 'invalid':
          return Promise.resolve({ output: { summary: 42, qualification: 'high' } });
      }
    },
  };
}
