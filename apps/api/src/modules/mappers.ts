import type { Activity, Company, Contact, LeadDetail, LeadListItem, Message } from '@ai-crm/shared';
import type { Prisma } from '../generated/prisma/client';

// Prisma row → DTO ของ packages/shared
// เลือก field ด้วย select ทุกครั้ง เพื่อไม่ให้ field ภายใน (passwordHash, lineUserId ดิบ) หลุดออกไป

const ref = { select: { id: true, name: true } } as const;

function iso(date: Date): string {
  return date.toISOString();
}

function isoOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function toLineLink(contact: { lineUserId: string | null; lineDisplayName: string | null }) {
  return { linked: contact.lineUserId !== null, displayName: contact.lineDisplayName };
}

// ───────── company ─────────

export const companySelect = {
  id: true,
  name: true,
  domain: true,
  industry: true,
  employeeCount: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { contacts: true, leads: true } },
} satisfies Prisma.CompanySelect;

export function toCompany(
  row: Prisma.CompanyGetPayload<{ select: typeof companySelect }>,
): Company {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    industry: row.industry,
    employeeCount: row.employeeCount,
    contactCount: row._count.contacts,
    leadCount: row._count.leads,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

// ───────── contact ─────────

export const contactSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  jobTitle: true,
  lineUserId: true,
  lineDisplayName: true,
  createdAt: true,
  updatedAt: true,
  company: ref,
} satisfies Prisma.ContactSelect;

export function toContact(
  row: Prisma.ContactGetPayload<{ select: typeof contactSelect }>,
): Contact {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    jobTitle: row.jobTitle,
    company: row.company,
    line: toLineLink(row),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

// ───────── lead ─────────

export const leadListSelect = {
  id: true,
  title: true,
  stage: true,
  source: true,
  value: true,
  score: true,
  stageChangedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  contact: ref,
  company: ref,
  owner: ref,
} satisfies Prisma.LeadSelect;

export function toLeadListItem(
  row: Prisma.LeadGetPayload<{ select: typeof leadListSelect }>,
): LeadListItem {
  return {
    id: row.id,
    title: row.title,
    stage: row.stage,
    source: row.source,
    value: row.value === null ? null : row.value.toNumber(),
    score: row.score,
    stageChangedAt: iso(row.stageChangedAt),
    closedAt: isoOrNull(row.closedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    contact: row.contact,
    company: row.company,
    owner: row.owner,
  };
}

export const leadDetailSelect = {
  ...leadListSelect,
  summary: true,
  lostReason: true,
  contact: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      jobTitle: true,
      lineUserId: true,
      lineDisplayName: true,
    },
  },
  company: { select: { id: true, name: true, domain: true, industry: true } },
} satisfies Prisma.LeadSelect;

export function toLeadDetail(
  row: Prisma.LeadGetPayload<{ select: typeof leadDetailSelect }>,
): LeadDetail {
  return {
    ...toLeadListItem({ ...row, contact: { id: row.contact.id, name: row.contact.name } }),
    summary: row.summary,
    lostReason: row.lostReason,
    contact: {
      id: row.contact.id,
      name: row.contact.name,
      email: row.contact.email,
      phone: row.contact.phone,
      jobTitle: row.contact.jobTitle,
      line: toLineLink(row.contact),
    },
    company: row.company,
  };
}

// ───────── timeline ─────────

export const activitySelect = {
  id: true,
  type: true,
  body: true,
  metadata: true,
  dueAt: true,
  completedAt: true,
  createdAt: true,
  actor: ref,
} satisfies Prisma.ActivitySelect;

function isJsonObject(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toActivity(
  row: Prisma.ActivityGetPayload<{ select: typeof activitySelect }>,
): Activity {
  return {
    id: row.id,
    type: row.type,
    body: row.body,
    metadata: isJsonObject(row.metadata) ? row.metadata : null,
    dueAt: isoOrNull(row.dueAt),
    completedAt: isoOrNull(row.completedAt),
    createdAt: iso(row.createdAt),
    actor: row.actor,
  };
}

export const messageSelect = {
  id: true,
  direction: true,
  channel: true,
  status: true,
  text: true,
  sentAt: true,
  createdAt: true,
  aiSuggestionId: true,
  sentBy: ref,
} satisfies Prisma.MessageSelect;

export function toMessage(
  row: Prisma.MessageGetPayload<{ select: typeof messageSelect }>,
): Message {
  return {
    id: row.id,
    direction: row.direction,
    channel: row.channel,
    status: row.status,
    text: row.text,
    sentAt: isoOrNull(row.sentAt),
    createdAt: iso(row.createdAt),
    sentBy: row.sentBy,
    fromAiSuggestion: row.aiSuggestionId !== null,
  };
}
