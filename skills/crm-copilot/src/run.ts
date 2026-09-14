import {
  copilotInputSchema,
  copilotOutputSchema,
  type CopilotInput,
  type CopilotOutput,
} from '@ai-crm/shared';
import { ruleBasedFallback } from './fallback';
import { applyGuardrails } from './guardrails';
import { PROMPT_VERSION } from './prompt';
import {
  CopilotProviderError,
  type CopilotProvider,
  type FallbackReason,
  type ProviderUsage,
} from './provider';

export interface CopilotRunOptions {
  /** null = ไม่ได้ตั้ง API key → ใช้กติกาสำรองทันที */
  provider: CopilotProvider | null;
  timeoutMs: number;
}

export interface CopilotResult {
  source: 'LLM' | 'FALLBACK';
  output: CopilotOutput;
  aiModel: string | null;
  promptVersion: string;
  latencyMs: number;
  fallbackReason: FallbackReason | null;
  /** รายละเอียดสำหรับ log เท่านั้น — ไม่แสดงให้ผู้ใช้ */
  fallbackDetail: string | null;
  usage: ProviderUsage | null;
}

/**
 * จุดเข้าเดียวของ skill: รับ CRM context → คืนคำแนะนำที่ผ่าน schema และ guardrail แล้วเสมอ (ไม่ throw)
 * skill นี้ไม่มีสิทธิ์เขียน DB หรือส่งข้อความ — ผลลัพธ์เป็นแค่ข้อเสนอให้คนอนุมัติ
 */
export async function runCrmCopilot(
  rawInput: CopilotInput,
  options: CopilotRunOptions,
): Promise<CopilotResult> {
  const input = copilotInputSchema.parse(rawInput);
  const started = Date.now();

  const fallback = (reason: FallbackReason, detail: string | null): CopilotResult => ({
    source: 'FALLBACK',
    output: applyGuardrails(ruleBasedFallback(input), input),
    aiModel: null,
    promptVersion: PROMPT_VERSION,
    latencyMs: Date.now() - started,
    fallbackReason: reason,
    fallbackDetail: detail,
    usage: null,
  });

  const { provider } = options;
  if (!provider) return fallback('no_api_key', null);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const { output, usage } = await provider.generate(input, controller.signal);
    // ตรวจซ้ำแม้ provider บอกว่า parse แล้ว — ไม่เชื่อ output ของ LLM
    const parsed = copilotOutputSchema.safeParse(output);
    if (!parsed.success) {
      return fallback('invalid_output', parsed.error.issues[0]?.message ?? 'schema mismatch');
    }
    return {
      source: 'LLM',
      output: applyGuardrails(parsed.data, input),
      aiModel: provider.model,
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - started,
      fallbackReason: null,
      fallbackDetail: null,
      usage: usage ?? null,
    };
  } catch (error) {
    if (controller.signal.aborted)
      return fallback('timeout', `no answer within ${options.timeoutMs}ms`);
    if (error instanceof CopilotProviderError) return fallback(error.reason, error.message);
    return fallback('provider_error', error instanceof Error ? error.message : 'unknown error');
  } finally {
    clearTimeout(timer);
  }
}
