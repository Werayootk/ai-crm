import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 ไม่โหลด .env เอง — ค่าที่ตั้งไว้ใน environment อยู่แล้ว (CI, Railway) จะไม่ถูกทับ
loadDotenv({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // ไม่ใช้ env() ของ Prisma เพราะจะ throw ตอน `prisma generate` ใน Docker build ที่ยังไม่มี DATABASE_URL
    // คำสั่งที่ต้องต่อ DB จริง (migrate / seed) ยังล้มพร้อม error ชัดเจนถ้าไม่ได้ตั้ง
    url: process.env.DATABASE_URL,
  },
});
