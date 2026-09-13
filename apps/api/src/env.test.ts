import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('parseEnv', () => {
  it('applies defaults and coerces numbers', () => {
    expect(parseEnv({ ...valid, PORT: '5050' })).toEqual({
      NODE_ENV: 'development',
      PORT: 5050,
      LOG_LEVEL: 'info',
      DATABASE_URL: valid.DATABASE_URL,
      JWT_SECRET: valid.JWT_SECRET,
      SESSION_TTL_HOURS: 8,
      TRUST_PROXY: 1,
      AI_MODEL: 'claude-sonnet-5',
      AI_EFFORT: 'medium',
      AI_TIMEOUT_MS: 25_000,
      LINE_MODE: 'mock',
    });
  });

  it('treats a blank ANTHROPIC_API_KEY as not configured', () => {
    expect(parseEnv({ ...valid, ANTHROPIC_API_KEY: '  ' }).ANTHROPIC_API_KEY).toBeUndefined();
    expect(parseEnv({ ...valid, ANTHROPIC_API_KEY: ' FAKE_TEST_VALUE ' }).ANTHROPIC_API_KEY).toBe(
      'FAKE_TEST_VALUE',
    );
  });

  it('fails fast when required variables are missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/);
  });

  it('rejects a short JWT_SECRET', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: 'too-short' })).toThrow(
      /JWT_SECRET: must be at least 32 characters/,
    );
  });

  it('rejects a non-postgres DATABASE_URL without echoing its value', () => {
    // ค่าปลอมสำหรับ test เท่านั้น — ตรวจว่า error ไม่พิมพ์ส่วนที่เป็นรหัสผ่านออกมา
    const fakeUrl = 'mysql://user:FAKE_TEST_VALUE@localhost/db';
    const run = () => parseEnv({ ...valid, DATABASE_URL: fakeUrl });
    expect(run).toThrow(/DATABASE_URL: must be a postgres/);
    expect(run).not.toThrow(/FAKE_TEST_VALUE/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => parseEnv({ ...valid, PORT: '70000' })).toThrow(/PORT/);
  });
});
