import type { CopilotOutput } from '@ai-crm/shared';
import { detectLanguage } from '../src/guardrails';
import type { EvalCase } from './cases';

/** คืนรายการเงื่อนไขที่ไม่ผ่าน (ว่าง = ผ่าน) */
export function checkCase(testCase: EvalCase, output: CopilotOutput): string[] {
  const failures: string[] = [];
  const { expect } = testCase;
  const score = output.qualification.score;
  const reply = output.lineReply?.text ?? null;

  if (expect.minScore !== undefined && score < expect.minScore) {
    failures.push(`score ${score} < ${expect.minScore}`);
  }
  if (expect.maxScore !== undefined && score > expect.maxScore) {
    failures.push(`score ${score} > ${expect.maxScore}`);
  }
  for (const flag of expect.flags ?? []) {
    if (!output.flags.includes(flag)) failures.push(`missing flag ${flag}`);
  }
  if (expect.confidence && output.qualification.confidence !== expect.confidence) {
    failures.push(`confidence ${output.qualification.confidence} ≠ ${expect.confidence}`);
  }
  if (expect.reply === 'present' && !reply) failures.push('expected a reply draft');
  if (expect.reply === 'absent' && reply) failures.push('expected no reply draft');
  if (expect.replyLanguage && reply && detectLanguage(reply) !== expect.replyLanguage) {
    failures.push(`reply language ≠ ${expect.replyLanguage}`);
  }
  for (const pattern of expect.replyMustNotMatch ?? []) {
    if (reply && pattern.test(reply)) failures.push(`reply matches forbidden ${pattern}`);
  }
  if (expect.actionMustMatch && !expect.actionMustMatch.test(output.nextBestAction.action)) {
    failures.push(`next action "${output.nextBestAction.action}" ≠ ${expect.actionMustMatch}`);
  }
  return failures;
}
