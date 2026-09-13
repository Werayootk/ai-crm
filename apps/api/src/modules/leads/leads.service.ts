import {
  allowedTransitions,
  checkStageChange,
  LEAD_STAGES,
  type AuthUser,
  type LeadCreateInput,
  type LeadDetail,
  type LeadListItem,
  type LeadListQuery,
  type LeadStageChangeInput,
  type LeadUpdateInput,
  type Page,
  type PipelineSummary,
} from '@ai-crm/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { HttpError, notFound, validationError } from '../../http/errors';
import { cursorArgs, toPage } from '../../http/pagination';
import { leadDetailSelect, leadListSelect, toLeadDetail, toLeadListItem } from '../mappers';
import {
  assertActiveUser,
  assertCompanyExists,
  conflict,
  withPrismaErrors,
  type Db,
} from '../references';

// ───────── queries ─────────

export function ownerWhere(ownerId: string | undefined, user: AuthUser): Prisma.LeadWhereInput {
  if (ownerId === undefined) return {};
  if (ownerId === 'me') return { ownerId: user.id };
  if (ownerId === 'unassigned') return { ownerId: null };
  return { ownerId };
}

function leadWhere(query: LeadListQuery, user: AuthUser): Prisma.LeadWhereInput {
  const contains = query.q ? { contains: query.q, mode: 'insensitive' as const } : undefined;
  return {
    ...ownerWhere(query.ownerId, user),
    ...(query.stage ? { stage: { in: query.stage } } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.companyId ? { companyId: query.companyId } : {}),
    ...(query.contactId ? { contactId: query.contactId } : {}),
    ...(query.minScore === undefined ? {} : { score: { gte: query.minScore } }),
    ...(contains
      ? {
          OR: [
            { title: contains },
            { contact: { name: contains } },
            { company: { name: contains } },
          ],
        }
      : {}),
  };
}

function leadOrderBy(query: LeadListQuery): Prisma.LeadOrderByWithRelationInput[] {
  const { order } = query;
  switch (query.sort) {
    case 'value':
      return [{ value: { sort: order, nulls: 'last' } }, { id: order }];
    case 'score':
      return [{ score: { sort: order, nulls: 'last' } }, { id: order }];
    case 'createdAt':
      return [{ createdAt: order }, { id: order }];
    case 'stageChangedAt':
      return [{ stageChangedAt: order }, { id: order }];
    case 'updatedAt':
      return [{ updatedAt: order }, { id: order }];
  }
}

export async function listLeads(
  prisma: PrismaClient,
  query: LeadListQuery,
  user: AuthUser,
): Promise<Page<LeadListItem>> {
  const where = leadWhere(query, user);
  const [rows, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: leadListSelect,
      orderBy: leadOrderBy(query),
      take: query.limit + 1,
      ...cursorArgs(query.cursor),
    }),
    prisma.lead.count({ where }),
  ]);
  return toPage(rows, query.limit, total, toLeadListItem);
}

export async function getLeadDetail(db: Db, leadId: string): Promise<LeadDetail> {
  const row = await db.lead.findUnique({ where: { id: leadId }, select: leadDetailSelect });
  if (!row) throw notFound('Lead');
  return toLeadDetail(row);
}

export async function getPipeline(
  prisma: PrismaClient,
  ownerId: string | undefined,
  user: AuthUser,
): Promise<PipelineSummary> {
  const rows = await prisma.lead.groupBy({
    by: ['stage'],
    where: ownerWhere(ownerId, user),
    _count: { _all: true },
    _sum: { value: true },
  });
  return {
    stages: LEAD_STAGES.map((stage) => {
      const row = rows.find((candidate) => candidate.stage === stage);
      return {
        stage,
        count: row?._count._all ?? 0,
        totalValue: row?._sum.value?.toNumber() ?? 0,
      };
    }),
  };
}

// ───────── commands ─────────

function roundMoney(value: number | null | undefined): number | null | undefined {
  return typeof value === 'number' ? Math.round(value * 100) / 100 : value;
}

export async function createLead(
  prisma: PrismaClient,
  input: LeadCreateInput,
  actor: AuthUser,
): Promise<LeadDetail> {
  const leadId = await prisma.$transaction(async (tx) => {
    let contactId: string;
    let contactCompanyId: string | null;

    if (input.contact) {
      if (input.contact.companyId) {
        await assertCompanyExists(tx, input.contact.companyId, 'contact.companyId');
      }
      const contact = await withPrismaErrors(
        tx.contact.create({ data: input.contact, select: { id: true, companyId: true } }),
        { P2002: () => conflict('Another contact already uses this email', 'contact.email') },
      );
      contactId = contact.id;
      contactCompanyId = contact.companyId;
    } else {
      const contact = await tx.contact.findUnique({
        where: { id: input.contactId ?? '' },
        select: { id: true, companyId: true },
      });
      if (!contact) {
        throw validationError('Invalid request body', [
          { path: 'contactId', message: 'Contact not found' },
        ]);
      }
      contactId = contact.id;
      contactCompanyId = contact.companyId;
    }

    if (input.companyId) await assertCompanyExists(tx, input.companyId, 'companyId');
    // ไม่ระบุ owner = ผู้สร้างเป็นคนดูแล
    const ownerId = input.ownerId === undefined ? actor.id : input.ownerId;
    if (ownerId) await assertActiveUser(tx, ownerId, 'ownerId');

    const lead = await tx.lead.create({
      data: {
        title: input.title,
        value: roundMoney(input.value),
        score: input.score,
        source: 'MANUAL',
        stage: 'NEW',
        contactId,
        companyId: input.companyId === undefined ? contactCompanyId : input.companyId,
        ownerId,
      },
      select: { id: true },
    });
    await tx.activity.create({
      data: {
        leadId: lead.id,
        type: 'SYSTEM',
        body: 'สร้าง lead จากการบันทึกโดยทีมขาย',
        actorId: actor.id,
      },
    });
    return lead.id;
  });
  // อ่านหลัง commit: transaction เก็บแค่สิ่งที่ต้อง atomic (อ่าน relation ซ้อนใน transaction
  // ทำให้ Prisma ยิง query ขนานบน connection เดียว ซึ่ง pg@9 จะไม่รองรับ)
  return getLeadDetail(prisma, leadId);
}

const AUDITED_FIELDS = { ownerId: 'ผู้รับผิดชอบ', score: 'คะแนน', value: 'มูลค่าดีล' } as const;
type AuditedField = keyof typeof AUDITED_FIELDS;
type AuditedValue = string | number | null;

/** field ที่มีผลต่อการติดตามดีลต้องมีร่องรอยใน timeline ว่าใครเปลี่ยนจากอะไรเป็นอะไร */
export function auditedChanges(
  before: Record<AuditedField, AuditedValue>,
  after: Partial<Record<AuditedField, AuditedValue | undefined>>,
): Partial<Record<AuditedField, { from: AuditedValue; to: AuditedValue }>> {
  const changes: Partial<Record<AuditedField, { from: AuditedValue; to: AuditedValue }>> = {};
  for (const field of Object.keys(AUDITED_FIELDS) as AuditedField[]) {
    const next = after[field];
    if (next !== undefined && next !== before[field]) {
      changes[field] = { from: before[field], to: next };
    }
  }
  return changes;
}

export async function updateLead(
  prisma: PrismaClient,
  leadId: string,
  input: LeadUpdateInput,
  actor: AuthUser,
): Promise<LeadDetail> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.lead.findUnique({
      where: { id: leadId },
      select: { ownerId: true, score: true, value: true },
    });
    if (!before) throw notFound('Lead');
    if (input.ownerId) await assertActiveUser(tx, input.ownerId, 'ownerId');
    if (input.companyId) await assertCompanyExists(tx, input.companyId, 'companyId');

    const value = roundMoney(input.value);
    await tx.lead.update({
      where: { id: leadId },
      data: {
        title: input.title,
        value,
        score: input.score,
        summary: input.summary,
        companyId: input.companyId,
        ownerId: input.ownerId,
      },
    });

    const changes = auditedChanges(
      { ownerId: before.ownerId, score: before.score, value: before.value?.toNumber() ?? null },
      { ownerId: input.ownerId, score: input.score, value },
    );
    const changedFields = Object.keys(changes) as AuditedField[];
    if (changedFields.length > 0) {
      await tx.activity.create({
        data: {
          leadId,
          type: 'SYSTEM',
          body: `แก้ไข${changedFields.map((field) => AUDITED_FIELDS[field]).join(', ')}`,
          metadata: { changes },
          actorId: actor.id,
        },
      });
    }
  });
  return getLeadDetail(prisma, leadId);
}

export async function changeLeadStage(
  prisma: PrismaClient,
  leadId: string,
  input: LeadStageChangeInput,
  actor: AuthUser,
): Promise<{ lead: LeadDetail; from: LeadDetail['stage'] }> {
  const previousStage = await prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUnique({ where: { id: leadId }, select: { stage: true } });
    if (!current) throw notFound('Lead');
    const from = current.stage;

    const check = checkStageChange({ from, to: input.stage, lostReason: input.lostReason });
    if (!check.ok) {
      if (check.error === 'LOST_REASON_REQUIRED') {
        throw validationError('Invalid request body', [
          { path: 'lostReason', message: 'lostReason is required when moving a lead to LOST' },
        ]);
      }
      throw new HttpError(
        409,
        'CONFLICT',
        check.error === 'SAME_STAGE'
          ? `Lead is already in ${from}`
          : `Cannot move a lead from ${from} to ${input.stage}`,
        { from, to: input.stage, allowed: allowedTransitions(from) },
      );
    }

    const now = new Date();
    const closed = input.stage === 'WON' || input.stage === 'LOST';
    const lostReason = input.stage === 'LOST' ? (input.lostReason ?? null) : null;
    // เงื่อนไข stage: from กันคนสองคนย้าย stage พร้อมกันแล้ว timeline เพี้ยน
    const { count } = await tx.lead.updateMany({
      where: { id: leadId, stage: from },
      data: { stage: input.stage, stageChangedAt: now, closedAt: closed ? now : null, lostReason },
    });
    if (count === 0) {
      throw new HttpError(
        409,
        'CONFLICT',
        'Lead stage was changed by someone else — reload and retry',
      );
    }
    await tx.activity.create({
      data: {
        leadId,
        type: 'STAGE_CHANGE',
        metadata: { from, to: input.stage, ...(lostReason ? { lostReason } : {}) },
        actorId: actor.id,
        createdAt: now,
      },
    });
    return from;
  });
  return { lead: await getLeadDetail(prisma, leadId), from: previousStage };
}
