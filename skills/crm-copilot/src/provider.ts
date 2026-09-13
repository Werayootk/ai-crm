import type { CopilotInput, CopilotOutput } from '@ai-crm/shared';

/** เหตุผลที่ต้องใช้กติกาสำรองแทน AI — เก็บลง AiSuggestion.fallbackReason */
export type FallbackReason =
  'no_api_key' | 'timeout' | 'provider_error' | 'refusal' | 'invalid_output';

export class CopilotProviderError extends Error {
  constructor(
    readonly reason: Exclude<FallbackReason, 'no_api_key'>,
    message: string,
  ) {
    super(message);
    this.name = 'CopilotProviderError';
  }
}

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * แหล่งที่มาของคำแนะนำ — ไม่มีสิทธิ์เขียน DB หรือส่งข้อความ รับ context เข้า คืน output ออกเท่านั้น
 * `output` เป็น unknown เสมอ: runCrmCopilot ตรวจด้วย schema ซ้ำ ไม่เชื่อ provider
 */
export interface CopilotProvider {
  readonly name: string;
  readonly model: string;
  generate(
    input: CopilotInput,
    signal: AbortSignal,
  ): Promise<{ output: unknown; usage?: ProviderUsage | undefined }>;
}

export type { CopilotOutput };
