import { afterAll } from 'vitest';
import { closeTestServers } from './helpers';

// ปิด server ของ createTestApp ทุกตัวเมื่อจบไฟล์ test
afterAll(closeTestServers);
