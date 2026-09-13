import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'crm_session';

/**
 * กันหน้าในแอปไว้หลัง login แบบเบาๆ: ไม่มี cookie → ส่งไปหน้า login
 * ความถูกต้องของ session ตรวจที่ API ทุก request (cookie ปลอม/หมดอายุจะได้ 401 แล้ว client พากลับมา login)
 * ห้ามพา /login ไปหน้าอื่นเพียงเพราะมี cookie — cookie ที่หมดอายุจะทำให้ redirect วนไม่จบ
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // ไม่ครอบ /api (ไปที่ API ผ่าน rewrite), หน้า login, health check และไฟล์ static / icon
  matcher: ['/((?!api|login|healthz|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
