import type { AuthUser } from '@ai-crm/shared';
import bcrypt from 'bcryptjs';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';

export const authUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
} satisfies Prisma.UserSelect;

// hash ของค่าที่ไม่มีใครใช้เป็นรหัสผ่าน — ใช้ compare ตอนไม่พบ user เพื่อให้เวลาตอบเท่ากัน (กันเดา email)
const TIMING_EQUALISER_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 10);

/** คืน user เมื่อ email + password ถูกต้องและบัญชียัง active — ทุกกรณีที่ไม่ผ่านคืน null เหมือนกัน */
export async function verifyCredentials(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...authUserSelect, passwordHash: true, isActive: true },
  });
  const passwordMatches = await bcrypt.compare(
    password,
    user?.passwordHash ?? TIMING_EQUALISER_HASH,
  );
  if (!user || !user.isActive || !passwordMatches) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function findActiveUser(
  prisma: PrismaClient,
  userId: string,
): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...authUserSelect, isActive: true },
  });
  if (!user?.isActive) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
