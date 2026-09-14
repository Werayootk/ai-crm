import { z } from 'zod';
import {
  blankToNull,
  domainSchema,
  hasAnyField,
  isoDateTimeSchema,
  optionalText,
  paginationQuerySchema,
  requiredText,
  searchQuerySchema,
} from './common';

const companyFields = {
  name: requiredText(200),
  domain: blankToNull(domainSchema),
  industry: optionalText(100),
  employeeCount: z.number().int().min(0).max(10_000_000).nullable().optional(),
};

export const companyCreateInputSchema = z.object(companyFields);
export type CompanyCreateInput = z.infer<typeof companyCreateInputSchema>;

export const companyUpdateInputSchema = z
  .object(companyFields)
  .partial()
  .refine(hasAnyField, 'At least one field is required');
export type CompanyUpdateInput = z.infer<typeof companyUpdateInputSchema>;

export const companyListQuerySchema = paginationQuerySchema.extend({ q: searchQuerySchema });
export type CompanyListQuery = z.infer<typeof companyListQuerySchema>;

export const companySchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  industry: z.string().nullable(),
  employeeCount: z.number().int().nullable(),
  contactCount: z.number().int(),
  leadCount: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Company = z.infer<typeof companySchema>;
