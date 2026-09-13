import type { UserListResponse } from '@ai-crm/shared';
import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client';
import { route } from '../../http/route';
import { authUserSelect } from '../auth/auth.service';

export function createUsersRouter(prisma: PrismaClient): Router {
  const router = Router();

  // ทีมมี ~20 คน — ส่งทั้งหมดสำหรับ dropdown เลือก owner และ filter
  router.get(
    '/users',
    route({ auth: 'user' }, async ({ res }) => {
      const items = await prisma.user.findMany({
        where: { isActive: true },
        select: authUserSelect,
        orderBy: { name: 'asc' },
      });
      res.json({ items } satisfies UserListResponse);
    }),
  );

  return router;
}
