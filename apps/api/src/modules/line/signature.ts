import { createHmac, timingSafeEqual } from 'node:crypto';

/** ลายเซ็นของ LINE: Base64(HMAC-SHA256(channel secret, body ดิบ)) — ใช้ใน test และ `pnpm line:simulate` ด้วย */
export function signLineBody(rawBody: Buffer | string, channelSecret: string): string {
  return createHmac('sha256', channelSecret).update(rawBody).digest('base64');
}

/**
 * ตรวจ header `x-line-signature` กับ body ดิบก่อน parse ใดๆ
 * (LINE: ถ้า body ถูก parse / serialize ใหม่ก่อนตรวจ จะแยกไม่ออกจาก request ที่ถูกแก้กลางทาง)
 * เทียบแบบเวลาคงที่ เพื่อไม่ให้เดาลายเซ็นทีละตัวจากเวลาตอบ
 */
export function verifyLineSignature(
  rawBody: Buffer,
  signature: string | undefined,
  channelSecret: string,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signLineBody(rawBody, channelSecret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
