import { config as loadDotenv } from 'dotenv';
import { createApp } from './app';
import { createPrisma } from './db';
import { parseEnv, type Env } from './env';
import { createLogger } from './logger';

// production (Railway) ตั้ง env ให้แล้ว — .env ใช้แค่ตอน dev และไม่ทับค่าที่มีอยู่
loadDotenv({ quiet: true });

let env: Env;
try {
  env = parseEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const logger = createLogger(env);
const prisma = createPrisma(env.DATABASE_URL);
const app = createApp({ prisma, logger });

const server = app.listen(env.PORT, (error) => {
  if (error) {
    logger.fatal({ err: error }, 'failed to start api');
    process.exit(1);
  }
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'api listening');
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
