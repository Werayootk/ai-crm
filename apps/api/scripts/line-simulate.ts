/**
 * จำลอง LINE ส่ง webhook เข้า API ที่รันอยู่ — ทดลอง flow LINE บนเครื่องโดยไม่ต้องมี LINE OA / มือถือ
 * เซ็น body ด้วย LINE_CHANNEL_SECRET จาก apps/api/.env แบบเดียวกับ LINE Platform
 *
 *   pnpm line:simulate "สนใจทำเว็บไซต์ครับ"
 *   pnpm line:simulate "ข้อความเดิม" --repeat 2        # ส่ง event เดิมซ้ำ (ทดสอบกันซ้ำ)
 *   pnpm line:simulate "ทดสอบ" --user U0123...          # ผู้ใช้ LINE คนเดิม → lead เดิม
 *   pnpm line:simulate "ทดสอบ" --bad-signature          # ต้องได้ 401
 */
import { config as loadDotenv } from 'dotenv';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { signLineBody } from '../src/modules/line/signature';

loadDotenv({ path: new URL('../.env', import.meta.url), quiet: true });

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    user: { type: 'string', default: 'U5a1e5d000000000000000000000de001' },
    url: { type: 'string', default: process.env.LINE_SIMULATE_URL ?? 'http://localhost:4000' },
    repeat: { type: 'string', default: '1' },
    'bad-signature': { type: 'boolean', default: false },
  },
});

const secret = process.env.LINE_CHANNEL_SECRET?.trim();
if (!secret) {
  console.error(
    'ต้องตั้ง LINE_CHANNEL_SECRET ใน apps/api/.env ก่อน (local ใช้ค่าอะไรก็ได้ เช่น `openssl rand -hex 16`) แล้ว restart api',
  );
  process.exit(1);
}

/** webhookEventId ของ LINE เป็น ULID — จำลองรูปแบบเดียวกัน (เวลา 10 ตัว + สุ่ม 16 ตัว) */
function ulid(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let time = Date.now();
  let out = '';
  for (let i = 0; i < 10; i++) {
    out = alphabet.charAt(time % 32) + out;
    time = Math.floor(time / 32);
  }
  for (const byte of randomBytes(16)) out += alphabet.charAt(byte % 32);
  return out;
}

const text = positionals.join(' ') || 'สวัสดีครับ สนใจทำเว็บไซต์ใหม่ อยากทราบรายละเอียด';
const repeat = Math.max(1, Number.parseInt(values.repeat, 10) || 1);
const event = {
  type: 'message',
  mode: 'active',
  timestamp: Date.now(),
  source: { type: 'user', userId: values.user },
  webhookEventId: ulid(),
  deliveryContext: { isRedelivery: false },
  replyToken: randomBytes(16).toString('hex'),
  message: {
    id: String(Date.now()),
    type: 'text',
    text,
    quoteToken: randomBytes(8).toString('hex'),
  },
};

for (let attempt = 0; attempt < repeat; attempt++) {
  const body = JSON.stringify({
    destination: 'U0000000000000000000000000000b0t',
    events: [{ ...event, deliveryContext: { isRedelivery: attempt > 0 } }],
  });
  const signature = values['bad-signature'] ? 'invalid-signature' : signLineBody(body, secret);
  const res = await fetch(`${values.url}/api/webhooks/line`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-line-signature': signature },
    body,
  });
  console.log(`#${attempt + 1} ${res.status} ${await res.text()}`);
  if (!res.ok) process.exitCode = 1;
}
if (process.exitCode !== 1) {
  console.log(
    `\nevent ${event.webhookEventId} จาก ${values.user} — เปิดหน้า Leads กรองที่มา "LINE" เพื่อดูข้อความและร่างคำตอบของ AI`,
  );
}
