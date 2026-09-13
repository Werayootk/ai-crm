import { copilotOutputSchema } from '@ai-crm/shared';
import Anthropic, {
  AnthropicError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { renderUserMessage, SYSTEM_PROMPT } from '../prompt';
import { CopilotProviderError, type CopilotProvider } from '../provider';

export interface ClaudeProviderConfig {
  apiKey: string;
  /** ผู้ใช้เลือก claude-sonnet-5 */
  model: string;
  effort: 'low' | 'medium' | 'high';
  maxTokens?: number;
  /** SDK retry เองเฉพาะ 408/409/429/5xx และ network error */
  maxRetries?: number;
  /** สำหรับ test — แทน network ด้วย fetch ปลอม */
  fetch?: typeof fetch;
}

function classify(error: unknown): CopilotProviderError {
  if (error instanceof CopilotProviderError) return error;
  if (error instanceof APIUserAbortError || error instanceof APIConnectionTimeoutError) {
    return new CopilotProviderError('timeout', 'Claude request timed out');
  }
  if (error instanceof APIError) {
    return new CopilotProviderError('provider_error', `Claude API error ${error.status ?? '-'}`);
  }
  // SDK โยน AnthropicError (ไม่ใช่ APIError) เมื่อ structured output ไม่ผ่าน zod schema
  if (error instanceof AnthropicError) {
    return new CopilotProviderError(
      'invalid_output',
      error.message.split('\n')[0] ?? 'invalid output',
    );
  }
  return new CopilotProviderError('provider_error', 'Unexpected error calling Claude');
}

export function createClaudeProvider(config: ClaudeProviderConfig): CopilotProvider {
  const client = new Anthropic({
    apiKey: config.apiKey,
    maxRetries: config.maxRetries ?? 1,
    ...(config.fetch ? { fetch: config.fetch } : {}),
  });

  return {
    name: 'claude',
    model: config.model,
    async generate(input, signal) {
      try {
        const response = await client.messages.parse(
          {
            model: config.model,
            max_tokens: config.maxTokens ?? 16_000,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: renderUserMessage(input) }],
            output_config: { format: zodOutputFormat(copilotOutputSchema), effort: config.effort },
          },
          { signal },
        );
        if (response.stop_reason === 'refusal') {
          throw new CopilotProviderError('refusal', 'Claude declined to answer');
        }
        if (response.stop_reason === 'max_tokens') {
          throw new CopilotProviderError('invalid_output', 'Output was cut off at max_tokens');
        }
        if (!response.parsed_output) {
          throw new CopilotProviderError('invalid_output', 'No structured output in response');
        }
        return {
          output: response.parsed_output,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
        };
      } catch (error) {
        throw classify(error);
      }
    },
  };
}
