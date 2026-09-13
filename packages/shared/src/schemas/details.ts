import { z } from 'zod';
import { companySchema } from './company';
import { contactSchema } from './contact';
import { leadListItemSchema } from './lead';

// หน้า detail ที่รวมหลาย entity — แยกไฟล์เพื่อไม่ให้ schema import วนกัน

export const companyDetailSchema = companySchema.extend({
  contacts: z.array(contactSchema),
  leads: z.array(leadListItemSchema),
});
export type CompanyDetail = z.infer<typeof companyDetailSchema>;

export const contactDetailSchema = contactSchema.extend({
  leads: z.array(leadListItemSchema),
});
export type ContactDetail = z.infer<typeof contactDetailSchema>;
