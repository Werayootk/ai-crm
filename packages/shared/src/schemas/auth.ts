import { z } from 'zod';
import { userRoleSchema } from '../enums';
import { emailSchema } from './common';

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: userRoleSchema,
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authResponseSchema = z.object({ user: authUserSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const userListResponseSchema = z.object({ items: z.array(authUserSchema) });
export type UserListResponse = z.infer<typeof userListResponseSchema>;
