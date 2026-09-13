import type { HealthResponse } from '@ai-crm/shared';
import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';

const DB_PING_TIMEOUT_MS = 2_000;

export function createHealthRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/health', async (req, res) => {
    const ping = await pingDb(prisma);
    if (!ping.ok) {
      req.log.warn({ err: ping.error }, 'health check: database ping failed');
    }
    const body: HealthResponse = {
      status: ping.ok ? 'ok' : 'degraded',
      db: ping.ok ? 'up' : 'down',
      uptimeSec: Math.floor(process.uptime()),
      time: new Date().toISOString(),
    };
    res.status(ping.ok ? 200 : 503).json(body);
  });

  return router;
}

async function pingDb(prisma: PrismaClient): Promise<{ ok: true } | { ok: false; error: unknown }> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('database ping timed out')), DB_PING_TIMEOUT_MS);
  });
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}
