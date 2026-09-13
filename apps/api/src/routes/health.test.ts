import { apiErrorResponseSchema, healthResponseSchema } from '@ai-crm/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrisma } from '../db';
import { createTestPrisma } from '../../test/test-db';
import { createTestApp } from '../../test/helpers';

const prisma = createTestPrisma();
// port 1 ไม่มีอะไรฟังอยู่ → จำลอง DB ล่ม
const unreachablePrisma = createPrisma('postgresql://postgres:postgres@127.0.0.1:1/ai_crm_test');

afterAll(async () => {
  await Promise.all([prisma.$disconnect(), unreachablePrisma.$disconnect()]);
});

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const res = await request(await createTestApp(prisma)).get('/api/health');

    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(res.body);
    // test app: ไม่มี AI key + LINE จำลอง
    expect(body).toMatchObject({ status: 'ok', db: 'up', ai: 'fallback', line: 'mock' });
    expect(res.headers['x-request-id']).toBeTruthy();
    // security headers จาก helmet และไม่เปิด CORS
    expect(res.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
    });
    expect(res.headers['strict-transport-security']).toMatch(/max-age=/);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('reports degraded with 503 when the database is down', async () => {
    const res = await request(await createTestApp(unreachablePrisma)).get('/api/health');

    expect(res.status).toBe(503);
    expect(healthResponseSchema.parse(res.body)).toMatchObject({ status: 'degraded', db: 'down' });
  });

  it('echoes a safe x-request-id and replaces an unsafe one', async () => {
    const app = await createTestApp(prisma);
    const safe = await request(app).get('/api/health').set('x-request-id', 'trace-123');
    expect(safe.headers['x-request-id']).toBe('trace-123');

    // header ถูกต้องตาม HTTP แต่ไม่ผ่าน pattern ของเรา (มีช่องว่างและ <>) → ต้องถูกแทนด้วย id ใหม่
    const unsafe = await request(app).get('/api/health').set('x-request-id', '<script> x');
    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('error format', () => {
  it('returns NOT_FOUND in the standard error shape for unknown routes', async () => {
    const res = await request(await createTestApp(prisma)).get('/api/nope');

    expect(res.status).toBe(404);
    expect(apiErrorResponseSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('returns INVALID_JSON for a malformed JSON body', async () => {
    const res = await request(await createTestApp(prisma))
      .post('/api/health')
      .set('content-type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(apiErrorResponseSchema.parse(res.body).error.code).toBe('INVALID_JSON');
  });
});
