import type { RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client';
import { findActiveUser } from './auth.service';
import {
  clearSessionCookie,
  readSessionCookie,
  verifySessionToken,
  type SessionConfig,
} from './session';

/**
 * อ่าน session cookie ทุก request แล้วตั้ง res.locals.user — ไม่ block เอง
 * การบังคับสิทธิ์อยู่ที่ route({ auth }) ของแต่ละ endpoint
 * โหลด user จาก DB ทุกครั้งเพื่อให้ปิดบัญชี (isActive=false) มีผลทันทีแม้ token ยังไม่หมดอายุ
 */
export function createAuthenticate(prisma: PrismaClient, session: SessionConfig): RequestHandler {
  return async (req, res, next) => {
    const token = readSessionCookie(req);
    if (!token) {
      next();
      return;
    }
    const userId = await verifySessionToken(token, session);
    const user = userId ? await findActiveUser(prisma, userId) : null;
    if (user) {
      res.locals.user = user;
    } else {
      clearSessionCookie(res, session);
    }
    next();
  };
}
