export { runCrmCopilot, type CopilotResult, type CopilotRunOptions } from './run';
export { createClaudeProvider, type ClaudeProviderConfig } from './providers/claude';
export { createMockProvider, defaultMockOutput, type MockBehavior } from './providers/mock';
export { ruleBasedFallback } from './fallback';
export { applyGuardrails, safeReplyTemplate } from './guardrails';
export { PROMPT_VERSION, SYSTEM_PROMPT, renderUserMessage } from './prompt';
export {
  CopilotProviderError,
  type CopilotProvider,
  type FallbackReason,
  type ProviderUsage,
} from './provider';
