import type { CopilotFlag, CopilotInput, CopilotOutput, LeadStage } from '@ai-crm/shared';
import {
  asksAboutPrice,
  hasUnansweredInbound,
  latestInbound,
  looksLikeInjection,
  safeReplyTemplate,
} from './guardrails';

const DAY_MS = 86_400_000;

const BASE_SCORE: Record<LeadStage, number> = {
  NEW: 20,
  QUALIFIED: 50,
  PROPOSAL: 65,
  WON: 90,
  LOST: 10,
};

function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / DAY_MS));
}

function lastTouchAt(input: CopilotInput): string | undefined {
  const times = [...input.activities.map((a) => a.at), ...input.messages.map((m) => m.at)];
  return times.sort().at(-1);
}

function nextAction(
  input: CopilotInput,
  daysSinceTouch: number | null,
): CopilotOutput['nextBestAction'] {
  if (input.contact.hasLine && hasUnansweredInbound(input)) {
    return {
      action: 'ตอบข้อความลูกค้าทาง LINE',
      dueInDays: 0,
      rationale: 'ลูกค้าส่งข้อความมาล่าสุดและยังไม่มีใครตอบ',
    };
  }
  switch (input.lead.stage) {
    case 'LOST':
      return {
        action: 'ติดต่อกลับเพื่อสำรวจโอกาสใหม่',
        dueInDays: 30,
        rationale: 'lead ปิดเป็น Lost แล้ว เว้นระยะก่อนติดต่อใหม่',
      };
    case 'WON':
      return {
        action: 'ติดตามความพึงพอใจและโอกาสขายเพิ่ม',
        dueInDays: 14,
        rationale: 'ปิดการขายได้แล้ว รักษาความสัมพันธ์กับลูกค้า',
      };
    default:
      break;
  }
  if (daysSinceTouch !== null && daysSinceTouch > 14) {
    return {
      action: 'โทรติดต่อกลับเพื่อกระตุ้นความสนใจ',
      dueInDays: 1,
      rationale: `ไม่มีความเคลื่อนไหวมา ${daysSinceTouch} วัน`,
    };
  }
  switch (input.lead.stage) {
    case 'NEW':
      return {
        action: 'โทรคัดกรองความต้องการ งบประมาณ และกำหนดเวลา',
        dueInDays: 1,
        rationale: 'lead ใหม่ที่ยังไม่ได้คัดกรอง',
      };
    case 'QUALIFIED':
      return {
        action: 'นัดประชุมเก็บ requirement เพื่อเตรียมใบเสนอราคา',
        dueInDays: 3,
        rationale: 'ผ่านการคัดกรองแล้ว ขั้นต่อไปคือรายละเอียดงาน',
      };
    default:
      return {
        action: 'ติดตามผลการพิจารณาใบเสนอราคา',
        dueInDays: 2,
        rationale: 'ส่งข้อเสนอแล้ว รอการตัดสินใจของลูกค้า',
      };
  }
}

/**
 * คำแนะนำจากกติกาตายตัว — ใช้เมื่อ AI ใช้ไม่ได้ (ไม่มี key, timeout, error, output ไม่ถูกต้อง)
 * ความมั่นใจต่ำเสมอ และยังต้องผ่านการอนุมัติจากคนเหมือนคำแนะนำของ AI
 */
export function ruleBasedFallback(input: CopilotInput): CopilotOutput {
  const reasons: string[] = [`อยู่ใน stage ${input.lead.stage} มา ${input.lead.daysInStage} วัน`];
  let score = BASE_SCORE[input.lead.stage];

  if (input.company) {
    score += 5;
    reasons.push(`มีข้อมูลบริษัท (${input.company.name})`);
  }
  const value = input.lead.value ?? 0;
  if (value >= 1_000_000) {
    score += 10;
    reasons.push('มูลค่าดีลสูง (ตั้งแต่ 1 ล้านบาท)');
  } else if (value >= 300_000) {
    score += 5;
    reasons.push('มูลค่าดีลปานกลาง (ตั้งแต่ 3 แสนบาท)');
  }

  const inbound = latestInbound(input);
  const daysSinceInbound = inbound ? daysBetween(inbound.at, input.now) : null;
  if (daysSinceInbound !== null && daysSinceInbound <= 3) {
    score += 10;
    reasons.push('ลูกค้าติดต่อเข้ามาภายใน 3 วัน');
  }
  const touch = lastTouchAt(input);
  const daysSinceTouch = touch ? daysBetween(touch, input.now) : null;
  if (daysSinceTouch !== null && daysSinceTouch > 30) {
    score -= 15;
    reasons.push(`ไม่มีความเคลื่อนไหวเกิน 30 วัน (${daysSinceTouch} วัน)`);
  }
  const injection = input.messages.some(
    (message) => message.direction === 'INBOUND' && looksLikeInjection(message.text),
  );
  if (injection) reasons.push('พบข้อความที่พยายามสั่งระบบ — ไม่นำมาคิดคะแนน');

  const flags = new Set<CopilotFlag>();
  if (injection) flags.add('PROMPT_INJECTION_SUSPECTED');
  if (inbound && asksAboutPrice(inbound.text)) flags.add('PRICE_REQUEST');
  const thin = !input.company && input.messages.length <= 1 && input.activities.length <= 1;
  if (thin) flags.add('MISSING_INFO');

  const lastText = inbound
    ? `ข้อความล่าสุดจากลูกค้า: "${inbound.text.slice(0, 120)}"`
    : 'ยังไม่มีข้อความจากลูกค้า';
  const summary = [
    `${input.lead.title} อยู่ใน stage ${input.lead.stage} มา ${input.lead.daysInStage} วัน`,
    input.lead.value === null
      ? 'ยังไม่ระบุมูลค่าดีล'
      : `มูลค่าดีลประมาณ ${value.toLocaleString('en-US')} บาท`,
    `มีกิจกรรม ${input.activities.length} รายการ และข้อความ ${input.messages.length} ข้อความ`,
    lastText,
  ].join(' · ');

  return {
    summary: summary.slice(0, 1200),
    qualification: {
      score: Math.min(100, Math.max(0, score)),
      reasons: reasons.slice(0, 5),
      confidence: 'low',
    },
    nextBestAction: nextAction(input, daysSinceTouch),
    lineReply:
      input.contact.hasLine && hasUnansweredInbound(input)
        ? { text: safeReplyTemplate(input) }
        : null,
    flags: [...flags],
  };
}
