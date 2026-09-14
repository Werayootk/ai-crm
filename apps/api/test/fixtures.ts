import type { LeadSource, LeadStage } from '@ai-crm/shared';
import type { PrismaClient } from '../src/generated/prisma/client';

let sequence = 0;
function next(): number {
  sequence += 1;
  return sequence;
}

export async function createCompany(prisma: PrismaClient, data: { name?: string } = {}) {
  const n = next();
  return prisma.company.create({
    data: { name: data.name ?? `Company ${n}`, domain: `company${n}-${Date.now()}.example` },
  });
}

export async function createContact(
  prisma: PrismaClient,
  data: { name?: string; companyId?: string | null; lineUserId?: string; phone?: string } = {},
) {
  const n = next();
  return prisma.contact.create({
    data: {
      name: data.name ?? `Contact ${n}`,
      email: `contact${n}-${Date.now()}@test.local`,
      phone: data.phone ?? null,
      companyId: data.companyId ?? null,
      lineUserId: data.lineUserId ?? null,
      lineDisplayName: data.lineUserId ? `LINE ${n}` : null,
    },
  });
}

/** สร้าง lead ตรงใน DB สำหรับเตรียมข้อมูล (ไม่ผ่านกติกา stage ของ API) */
export async function createLeadRow(
  prisma: PrismaClient,
  data: {
    contactId: string;
    title?: string;
    stage?: LeadStage;
    source?: LeadSource;
    ownerId?: string | null;
    companyId?: string | null;
    score?: number | null;
    value?: number | null;
  },
) {
  const stage = data.stage ?? 'NEW';
  const closed = stage === 'WON' || stage === 'LOST';
  return prisma.lead.create({
    data: {
      title: data.title ?? `Lead ${next()}`,
      stage,
      source: data.source ?? 'MANUAL',
      contactId: data.contactId,
      companyId: data.companyId ?? null,
      ownerId: data.ownerId ?? null,
      score: data.score ?? null,
      value: data.value ?? null,
      closedAt: closed ? new Date() : null,
      lostReason: stage === 'LOST' ? 'test' : null,
    },
  });
}
