import { pino, type Logger } from 'pino';
import type { Env } from './env';

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-line-signature"]',
        'res.headers["set-cookie"]',
      ],
      censor: '[REDACTED]',
    },
    ...(env.NODE_ENV === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : {}),
  });
}
