/**
 * รันชุดประเมิน: pnpm --filter @ai-crm/crm-copilot eval
 * มี ANTHROPIC_API_KEY (ใน env หรือ apps/api/.env) → ทดสอบกับ Claude จริง (มีค่าใช้จ่ายตาม token)
 * ไม่มี → ทดสอบกับกติกาสำรอง
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClaudeProvider } from '../src/providers/claude';
import { runCrmCopilot } from '../src/run';
import { EVAL_CASES } from './cases';
import { checkCase } from './check';

const apiEnv = fileURLToPath(new URL('../../../apps/api/.env', import.meta.url));
if (!process.env.ANTHROPIC_API_KEY && existsSync(apiEnv)) process.loadEnvFile(apiEnv);

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.AI_MODEL ?? 'claude-sonnet-5';
const provider = apiKey ? createClaudeProvider({ apiKey, model, effort: 'medium' }) : null;

console.log(
  `crm-copilot eval — provider: ${provider ? model : 'rule-based fallback (no ANTHROPIC_API_KEY)'}\n`,
);

let failed = 0;
for (const testCase of EVAL_CASES) {
  const result = await runCrmCopilot(testCase.input, { provider, timeoutMs: 60_000 });
  const failures = checkCase(testCase, result.output);
  if (failures.length > 0) failed += 1;
  const source =
    result.source === 'LLM' ? `LLM ${result.latencyMs}ms` : `FALLBACK:${result.fallbackReason}`;
  console.log(
    `${failures.length === 0 ? 'PASS' : 'FAIL'}  ${testCase.id.padEnd(20)} score=${String(result.output.qualification.score).padStart(3)}  ${source}`,
  );
  console.log(`      ${testCase.title}`);
  for (const failure of failures) console.log(`      ✗ ${failure}`);
}

console.log(`\n${EVAL_CASES.length - failed}/${EVAL_CASES.length} cases passed`);
process.exitCode = failed === 0 ? 0 : 1;
