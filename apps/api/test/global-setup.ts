import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createTestPrisma, getTestDatabaseUrl, truncateAll } from './test-db';

const apiDir = fileURLToPath(new URL('..', import.meta.url));

/** apply migrations ที่ยังไม่ได้ลง (ไม่ใช้ migrate reset) แล้วล้างข้อมูลใน DB ของ test */
export default async function setup(): Promise<void> {
  const url = getTestDatabaseUrl();
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  const prisma = createTestPrisma();
  try {
    await truncateAll(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
