import type { AuthUser } from '@ai-crm/shared';

declare global {
  namespace Express {
    interface Locals {
      /** ตั้งโดย authenticate middleware เมื่อ session cookie ถูกต้องและ user ยัง active */
      user?: AuthUser;
    }
  }
}

export {};
