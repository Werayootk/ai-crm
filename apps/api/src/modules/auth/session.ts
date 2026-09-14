import { parseCookie } from 'cookie';
import type { CookieOptions, Request, Response } from 'express';
import { jwtVerify, SignJWT } from 'jose';

export const SESSION_COOKIE = 'crm_session';
const ISSUER = 'ai-crm-api';
const AUDIENCE = 'ai-crm-web';

export interface SessionConfig {
  secret: string;
  ttlSeconds: number;
  /** true ใน production (HTTPS) */
  secureCookies: boolean;
}

function signingKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(userId: string, config: SessionConfig): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${config.ttlSeconds}s`)
    .sign(signingKey(config.secret));
}

/** คืน userId ถ้า token ถูกต้องและยังไม่หมดอายุ — ผิดทุกกรณีคืน null */
export async function verifySessionToken(
  token: string,
  config: SessionConfig,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(config.secret), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * httpOnly: JavaScript อ่าน token ไม่ได้ (กัน XSS ขโมย session)
 * SameSite=Lax: browser ไม่แนบ cookie กับ POST/PATCH/DELETE ข้ามเว็บ (กัน CSRF)
 */
function cookieOptions(config: SessionConfig): CookieOptions {
  return { httpOnly: true, secure: config.secureCookies, sameSite: 'lax', path: '/' };
}

export function setSessionCookie(res: Response, token: string, config: SessionConfig): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(config), maxAge: config.ttlSeconds * 1000 });
}

export function clearSessionCookie(res: Response, config: SessionConfig): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions(config));
}

export function readSessionCookie(req: Request): string | undefined {
  return parseCookie(req.headers.cookie ?? '')[SESSION_COOKIE];
}
