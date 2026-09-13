import { pino } from 'pino';
import type { PrismaClient } from '../src/generated/prisma/client';
import { createApp } from '../src/app';

export const silentLogger = pino({ level: 'silent' });

export function createTestApp(prisma: PrismaClient) {
  return createApp({ prisma, logger: silentLogger });
}
