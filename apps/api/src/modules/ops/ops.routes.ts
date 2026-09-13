import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client';
import { route } from '../../http/route';
import { getOpsSummary } from './ops.service';

export function createOpsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get(
    '/ops/summary',
    route({ auth: 'admin' }, async ({ res }) => {
      res.json(await getOpsSummary(prisma));
    }),
  );

  return router;
}
