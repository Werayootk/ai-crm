import { config as loadDotenv } from 'dotenv';
import { defineProject } from 'vitest/config';

// ให้ TEST_DATABASE_URL ใน apps/api/.env มีผล (CI ตั้งผ่าน env โดยตรง)
loadDotenv({ path: new URL('.env', import.meta.url), quiet: true });

export default defineProject({
  test: {
    name: 'api',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    // test ใช้ DB จริงตัวเดียวกัน — รันทีละไฟล์เพื่อไม่ให้ข้อมูลชนกัน
    fileParallelism: false,
  },
});
