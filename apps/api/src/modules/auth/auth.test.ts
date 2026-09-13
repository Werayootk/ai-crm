import {
  apiErrorResponseSchema,
  authResponseSchema,
  userListResponseSchema,
  type AuthUser,
} from '@ai-crm/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCompany } from '../../../test/fixtures';
import {
  createTestApp,
  createUser,
  loginAs,
  TEST_PASSWORD,
  testConfig,
} from '../../../test/helpers';
import { createTestPrisma, truncateAll } from '../../../test/test-db';
import { SESSION_COOKIE, signSessionToken } from './session';

const prisma = createTestPrisma();
const app = createTestApp(prisma);
let sales: AuthUser;
let inactive: AuthUser;

beforeAll(async () => {
  await truncateAll(prisma);
  sales = await createUser(prisma);
  inactive = await createUser(prisma, { isActive: false });
});

afterAll(async () => {
  await prisma.$disconnect();
});

function setCookieHeader(res: request.Response): string {
  const header: unknown = res.headers['set-cookie'];
  return Array.isArray(header) ? header.join('\n') : '';
}

function errorCode(res: request.Response): string {
  return apiErrorResponseSchema.parse(res.body).error.code;
}

describe('POST /api/auth/login', () => {
  it('sets an httpOnly SameSite=Lax session cookie and returns the user without secrets', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: sales.email.toUpperCase(), password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(authResponseSchema.parse(res.body).user).toEqual(sales);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    const cookie = setCookieHeader(res);
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('answers a wrong password and an unknown email with the same 401', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: sales.email, password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.local', password: TEST_PASSWORD });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password' },
      });
      expect(setCookieHeader(res)).toBe('');
    }
  });

  it('rejects a deactivated user even with the right password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: inactive.email, password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('validates the body before touching the database', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
  });

  it('rate limits repeated failed attempts per IP and email', async () => {
    const limited = createTestApp(prisma, {
      loginRateLimit: { windowMs: 60_000, limit: 3 },
    });
    const attempt = (email: string) =>
      request(limited).post('/api/auth/login').send({ email, password: 'wrong-password' });

    for (let i = 0; i < 3; i++) expect((await attempt(sales.email)).status).toBe(401);
    const blocked = await attempt(sales.email);
    expect(blocked.status).toBe(429);
    expect(errorCode(blocked)).toBe('RATE_LIMITED');

    // อีก email หนึ่งยังไม่ถูกบล็อก
    expect((await attempt('someone-else@test.local')).status).toBe(401);
  });
});

describe('session', () => {
  it('returns the logged-in user from GET /api/auth/me', async () => {
    const agent = await loginAs(app, sales);
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(authResponseSchema.parse(res.body).user).toEqual(sales);
  });

  it('requires a session for protected endpoints', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(errorCode(res)).toBe('UNAUTHENTICATED');
  });

  it('rejects a tampered token and clears the cookie', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `${SESSION_COOKIE}=not.a.valid-token`);
    expect(res.status).toBe(401);
    expect(setCookieHeader(res)).toMatch(new RegExp(`${SESSION_COOKIE}=;`));
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = await signSessionToken(sales.id, {
      ...testConfig.session,
      secret: 'attacker-controlled-secret-with-32-characters',
    });
    const res = await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${forged}`);
    expect(res.status).toBe(401);
  });

  it('locks a user out as soon as the account is deactivated', async () => {
    const user = await createUser(prisma);
    const agent = await loginAs(app, user);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('logs out by clearing the cookie', async () => {
    const agent = await loginAs(app, sales);
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('authorization', () => {
  it('forbids SALES from admin-only endpoints', async () => {
    const company = await createCompany(prisma);
    const agent = await loginAs(app, sales);
    const res = await agent.delete(`/api/companies/${company.id}`);
    expect(res.status).toBe(403);
    expect(errorCode(res)).toBe('FORBIDDEN');
  });
});

describe('GET /api/users', () => {
  it('lists active users only, without password hashes', async () => {
    const agent = await loginAs(app, sales);
    const res = await agent.get('/api/users');
    expect(res.status).toBe(200);
    const { items } = userListResponseSchema.parse(res.body);
    expect(items.map((user) => user.id)).toContain(sales.id);
    expect(items.map((user) => user.id)).not.toContain(inactive.id);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });
});
