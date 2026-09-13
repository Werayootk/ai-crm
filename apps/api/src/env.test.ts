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
    });
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
    const secretish = 'mysql://admin:super-secret-pw@db.internal/crm';
    const run = () => parseEnv({ ...valid, DATABASE_URL: secretish });
    expect(run).toThrow(/DATABASE_URL: must be a postgres/);
    expect(run).not.toThrow(/super-secret-pw/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => parseEnv({ ...valid, PORT: '70000' })).toThrow(/PORT/);
  });
});
