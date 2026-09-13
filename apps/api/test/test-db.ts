import type { PrismaClient } from '../src/generated/prisma/client';
import { createPrisma } from '../src/db';

const DEFAULT_TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/ai_crm_test';

/** URL ของ DB สำหรับ test — บังคับให้ชื่อลงท้าย _test เพราะ test ล้างข้อมูลทุกครั้ง */
export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `TEST_DATABASE_URL must point to a database whose name ends in "_test" (got "${dbName}") — tests wipe it`,
    );
  }
  return url;
}

export function createTestPrisma(): PrismaClient {
  return createPrisma(getTestDatabaseUrl());
}

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`TRUNCATE TABLE "Message", "AiSuggestion", "Activity", "Lead", "Contact", "Company", "User", "WebhookEvent" CASCADE`;
}
