/** health check ของเว็บเอง (Railway) — ไม่ขึ้นกับ API เพื่อไม่ให้ API ล่มแล้วเว็บ deploy ไม่ผ่านตาม */
export function GET() {
  return Response.json({ status: 'ok' });
}
