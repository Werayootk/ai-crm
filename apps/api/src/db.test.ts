import {
  ACTIVITY_TYPES,
  AI_SOURCES,
  AI_SUGGESTION_STATUSES,
  AI_SUGGESTION_TYPES,
  LEAD_SOURCES,
  LEAD_STAGES,
  MESSAGE_CHANNELS,
  MESSAGE_DIRECTIONS,
  MESSAGE_STATUSES,
  USER_ROLES,
  WEBHOOK_EVENT_STATUSES,
} from '@ai-crm/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as PrismaEnums from './generated/prisma/enums';
import { createTestPrisma, truncateAll } from '../test/test-db';

const prisma = createTestPrisma();
let contactId: string;

beforeAll(async () => {
  await truncateAll(prisma);
  contactId = (await prisma.contact.create({ data: { name: 'Constraint Test' } })).id;
});

afterAll(async () => {
  await truncateAll(prisma);
  await prisma.$disconnect();
});

function createLead(data: {
  stage?: 'NEW' | 'LOST' | 'WON';
  score?: number;
  value?: number;
  lostReason?: string;
  closedAt?: Date;
}) {
  return prisma.lead.create({ data: { title: 'Lead', source: 'MANUAL', contactId, ...data } });
}

describe('enums', () => {
  it('keeps packages/shared enums in sync with the Prisma schema', () => {
    const pairs: [object, readonly string[]][] = [
      [PrismaEnums.UserRole, USER_ROLES],
      [PrismaEnums.LeadStage, LEAD_STAGES],
      [PrismaEnums.LeadSource, LEAD_SOURCES],
      [PrismaEnums.ActivityType, ACTIVITY_TYPES],
      [PrismaEnums.MessageDirection, MESSAGE_DIRECTIONS],
      [PrismaEnums.MessageChannel, MESSAGE_CHANNELS],
      [PrismaEnums.MessageStatus, MESSAGE_STATUSES],
      [PrismaEnums.AiSuggestionType, AI_SUGGESTION_TYPES],
      [PrismaEnums.AiSuggestionStatus, AI_SUGGESTION_STATUSES],
      [PrismaEnums.AiSource, AI_SOURCES],
      [PrismaEnums.WebhookEventStatus, WEBHOOK_EVENT_STATUSES],
    ];
    for (const [prismaEnum, shared] of pairs) {
      expect(Object.values(prismaEnum)).toEqual([...shared]);
    }
  });
});

describe('Lead CHECK constraints', () => {
  it('rejects a score outside 0–100', async () => {
    await expect(createLead({ score: 101 })).rejects.toThrow(/Lead_score_range/);
    await expect(createLead({ score: 100 })).resolves.toMatchObject({ score: 100 });
  });

  it('rejects a negative deal value', async () => {
    await expect(createLead({ value: -1 })).rejects.toThrow(/Lead_value_non_negative/);
  });

  it('requires lostReason when stage is LOST', async () => {
    await expect(createLead({ stage: 'LOST', closedAt: new Date() })).rejects.toThrow(
      /Lead_lost_reason_required/,
    );
  });

  it('requires closedAt exactly when the lead is WON or LOST', async () => {
    await expect(createLead({ stage: 'WON' })).rejects.toThrow(/Lead_closed_at_matches_stage/);
    await expect(createLead({ stage: 'NEW', closedAt: new Date() })).rejects.toThrow(
      /Lead_closed_at_matches_stage/,
    );
    await expect(createLead({ stage: 'WON', closedAt: new Date() })).resolves.toBeTruthy();
  });
});

describe('AiSuggestion partial unique index', () => {
  it('allows only one PENDING suggestion per lead and type', async () => {
    const lead = await createLead({});
    const base = {
      leadId: lead.id,
      type: 'LINE_REPLY',
      payload: { text: 'draft' },
      source: 'FALLBACK',
      promptVersion: 'test',
    } as const;

    await prisma.aiSuggestion.create({ data: base });
    await expect(prisma.aiSuggestion.create({ data: base })).rejects.toMatchObject({
      code: 'P2002',
    });

    // ประเภทอื่น หรือสถานะที่ไม่ใช่ PENDING ไม่ติด constraint
    await expect(
      prisma.aiSuggestion.create({ data: { ...base, type: 'NEXT_ACTION' } }),
    ).resolves.toBeTruthy();
    await expect(
      prisma.aiSuggestion.create({ data: { ...base, status: 'SUPERSEDED' } }),
    ).resolves.toBeTruthy();
  });
});
