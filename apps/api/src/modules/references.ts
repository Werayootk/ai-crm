import type { Prisma, PrismaClient } from '../generated/prisma/client';
import { HttpError, isPrismaError, validationError } from '../http/errors';

/** ใช้ได้ทั้ง client ปกติและภายใน $transaction */
export type Db = PrismaClient | Prisma.TransactionClient;

// ตรวจ id ที่อ้างถึงก่อนเขียน เพื่อตอบ 400 ที่บอกได้ว่า field ไหนผิด (แทน FK error กว้างๆ)

export async function assertCompanyExists(db: Db, companyId: string, path: string): Promise<void> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company)
    throw validationError('Invalid request body', [{ path, message: 'Company not found' }]);
}

export async function assertActiveUser(db: Db, userId: string, path: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isActive: true } });
  if (!user?.isActive) {
    throw validationError('Invalid request body', [
      { path, message: 'User not found or inactive' },
    ]);
  }
}

/** แปล error ของ Prisma ที่มีความหมายเฉพาะใน use case นี้ ที่เหลือโยนต่อ */
export async function withPrismaErrors<T>(
  operation: Promise<T>,
  handlers: Partial<Record<'P2002' | 'P2003' | 'P2025', () => HttpError>>,
): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    for (const code of ['P2002', 'P2003', 'P2025'] as const) {
      const toHttpError = handlers[code];
      if (toHttpError && isPrismaError(error, code)) throw toHttpError();
    }
    throw error;
  }
}

export function conflict(message: string, path: string): HttpError {
  return new HttpError(409, 'CONFLICT', message, { issues: [{ path, message }] });
}
