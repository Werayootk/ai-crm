import type { CopilotFlag, CopilotInput, CopilotOutput } from '@ai-crm/shared';

// guardrail ฝั่งโค้ด — ทำงานกับ output ทุกครั้งไม่ว่ามาจาก AI หรือกติกาสำรอง
// (prompt อย่างเดียวไม่พอ: ต้องตรวจซ้ำก่อนให้คนเห็น)

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(the\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /disregard\s+.{0,20}instructions?/i,
  /system\s*prompt/i,
  /you\s+are\s+now\b/i,
  /set\s+(the\s+)?score\s+to/i,
  /(ละเว้น|ละทิ้ง|ไม่ต้องสนใจ|ลืม).{0,15}คำสั่ง/,
  /ให้คะแนน\s*\d+/,
];

const PRICE_PATTERNS = [
  /ราคา/,
  /เท่า(ไหร่|ไร)/,
  /ส่วนลด/,
  /ค่าใช้จ่าย/,
  /\bprice\b/i,
  /\bpricing\b/i,
  /\bquot(e|ation)\b/i,
  /\bdiscount\b/i,
  /\bhow\s+much\b/i,
  /\bcost\b/i,
];

/** จำนวนเงิน / เปอร์เซ็นต์ / ส่วนลดที่ระบุตัวเลข */
const MONEY_PATTERN =
  /(\d[\d,.]*\s*(บาท|฿|thb|%|เปอร์เซ็นต์|percent))|((฿|thb)\s*\d[\d,.]*)|(ส่วนลด\s*\d)|(discount\s+of\s+\d)/gi;

const LEAK_PATTERN = /crm_context|system\s*prompt|crm\s*copilot|as an ai\b|ในฐานะ\s*ai/i;

const THAI_CHARS = /[฀-๿]/g;
const LATIN_CHARS = /[a-z]/gi;

export function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function asksAboutPrice(text: string): boolean {
  return PRICE_PATTERNS.some((pattern) => pattern.test(text));
}

export function detectLanguage(text: string): 'th' | 'en' {
  const thai = text.match(THAI_CHARS)?.length ?? 0;
  const latin = text.match(LATIN_CHARS)?.length ?? 0;
  return latin > thai * 2 ? 'en' : 'th';
}

export function latestInbound(input: CopilotInput) {
  return input.messages.filter((message) => message.direction === 'INBOUND').at(-1);
}

/** ข้อความล่าสุดเป็นของลูกค้าและยังไม่มีใครตอบ */
export function hasUnansweredInbound(input: CopilotInput): boolean {
  return input.messages.at(-1)?.direction === 'INBOUND';
}

function digitsOf(text: string): string[] {
  return (text.match(/\d[\d,.]*/g) ?? []).map((token) => token.replace(/[,.]/g, ''));
}

/**
 * ตัวเลขที่ reply อ้างได้ต้องมาจากข้อมูลของทีม (มูลค่าดีล, บันทึกกิจกรรม) — ไม่ใช่จากข้อความลูกค้า
 * เช่น ลูกค้าขอส่วนลด 30% แล้ว AI ตอบว่า "ได้ส่วนลด 30%" = ให้สัญญาที่ทีมไม่ได้ให้ → ผิดกติกา
 */
function quotesUnapprovedAmount(reply: string, input: CopilotInput): boolean {
  const matches = reply.match(MONEY_PATTERN);
  if (!matches) return false;
  const teamNumbers = new Set([
    ...(input.lead.value === null ? [] : [String(Math.round(input.lead.value))]),
    ...input.activities.flatMap((activity) => digitsOf(activity.body ?? '')),
  ]);
  return matches.some((match) => digitsOf(match).some((digits) => !teamNumbers.has(digits)));
}

function firstName(name: string): string {
  const cleaned = name.replace(/^(คุณ|khun|mr\.?|ms\.?|mrs\.?)\s*/i, '').trim();
  return cleaned.split(/\s+/)[0] ?? cleaned;
}

/** "คุณสมชาย" ติดกัน แต่ชื่ออังกฤษเว้นวรรค: "คุณ John" */
function thaiHonorific(name: string): string {
  return /^[A-Za-z]/.test(name) ? `คุณ ${name}` : `คุณ${name}`;
}

/** ข้อความตอบกลับที่ปลอดภัย — ไม่ผูกมัดราคา / วันส่งมอบ ใช้ตอน AI ใช้ไม่ได้หรือ reply ผิดกติกา */
export function safeReplyTemplate(input: CopilotInput): string {
  const name = firstName(input.contact.name);
  const lastText = latestInbound(input)?.text ?? '';
  if (detectLanguage(lastText) === 'en') {
    return `Hi ${name}, thank you for reaching out. Our team has received your message and will get back to you with details within the next business day. Could you share the scope of work and your preferred timeline so we can prepare the right information?`;
  }
  return `สวัสดี${thaiHonorific(name)} ขอบคุณที่ติดต่อเข้ามา ทีมงานได้รับข้อความแล้ว และจะติดต่อกลับพร้อมรายละเอียดภายในวันทำการถัดไป หากสะดวก รบกวนแจ้งขอบเขตงานและช่วงเวลาที่ต้องการเริ่มเพิ่มเติม เพื่อให้เตรียมข้อมูลได้ตรงความต้องการ`;
}

export function applyGuardrails(output: CopilotOutput, input: CopilotInput): CopilotOutput {
  const flags = new Set<CopilotFlag>(output.flags);
  const inbound = input.messages.filter((message) => message.direction === 'INBOUND');
  const injection = inbound.some((message) => looksLikeInjection(message.text));
  if (injection) flags.add('PROMPT_INJECTION_SUSPECTED');
  const last = latestInbound(input);
  if (last && asksAboutPrice(last.text)) flags.add('PRICE_REQUEST');

  // ไม่มี LINE = ส่งไม่ได้อยู่แล้ว ไม่ต้องร่าง
  let lineReply = input.contact.hasLine ? output.lineReply : null;
  if (
    lineReply &&
    (quotesUnapprovedAmount(lineReply.text, input) || LEAK_PATTERN.test(lineReply.text))
  ) {
    lineReply = { text: safeReplyTemplate(input) };
    flags.add('REPLY_REPLACED_BY_GUARDRAIL');
  }

  return {
    ...output,
    qualification: {
      ...output.qualification,
      // มีความพยายามสั่ง AI ในข้อความ → ความมั่นใจของคะแนนต่ำเสมอ ให้คนตัดสินเอง
      confidence: injection ? 'low' : output.qualification.confidence,
    },
    lineReply,
    flags: [...flags].slice(0, 5),
  };
}
