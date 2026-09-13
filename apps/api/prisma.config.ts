import { config as loadDotenv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 ไม่โหลด .env เอง — ค่าที่ตั้งไว้ใน environment อยู่แล้ว (CI, Railway) จะไม่ถูกทับ
loadDotenv({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
