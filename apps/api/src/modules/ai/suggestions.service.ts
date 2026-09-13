import {
  APPROVE_FIELDS,
  SUGGESTION_FINAL_SCHEMAS,
  SUGGESTION_PAYLOAD_SCHEMAS,
  type AiSuggestion,
  type AiSuggestionApproveInput,
  type AiSuggestionDecision,
  type AiSuggestionRejectInput,
  type AiSuggestionStatus,
  type AuthUser,
} from '@ai-crm/shared';
import { runCrmCopilot, type CopilotRunOptions } from '@ai-crm/crm-copilot';
import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { HttpError, notFound, validationError } from '../../http/errors';
import type { LineClient } from '../line/line-client';
import { deliverMessage } from '../line/outbound';
import { messageSelect, toMessage } from '../mappers';
import { withPrismaErrors } from '../references';
import { buildCopilotInput } from './context';

export interface AiDeps {
  prisma: PrismaClient;
  logger: Logger;
  copilot: CopilotRunOptions;
  line: LineClient;
  lineRetryDelaysMs?: readonly number[];
}

const DAY_MS = 86_400_000;
const ref = { select: { id: true, name: true } } as const;

const suggestionSelect = {
  id: true,
  leadId: true,
  type: true,
  status: true,
  payload: true,
  finalPayload: true,
  source: true,
  aiModel: true,
  promptVersion: true,
  fallbackReason: true,
  latencyMs: true,
  createdAt: true,
  reviewedAt: true,
  rejectReason: true,
  requestedBy: ref,
  reviewedBy: ref,
} satisfies Prisma.AiSuggestionSelect;

type SuggestionRow = Prisma.AiSuggestionGetPayload<{ select: typeof suggestionSelect }>;

/** payload เป็น JSON ใน DB — parse ด้วย schema ของ shared ทุกครั้งก่อนส่งออก */
function toAiSuggestion(row: SuggestionRow): AiSuggestion {
  const base = {
    id: row.id,
    status: row.status,
    source: row.source,
    aiModel: row.aiModel,
    promptVersion: row.promptVersion,
    fallbackReason: row.fallbackReason,
    latencyMs: row.latencyMs,
    createdAt: row.createdAt.toISOString(),
    requestedBy: row.requestedBy,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    rejectReason: row.rejectReason,
  };
  switch (row.type) {
    case 'QUALIFICATION':
      return {
        ...base,
        type: row.type,
        payload: SUGGESTION_PAYLOAD_SCHEMAS.QUALIFICATION.parse(row.payload),
        finalPayload:
          row.finalPayload === null
            ? null
            : SUGGESTION_FINAL_SCHEMAS.QUALIFICATION.parse(row.finalPayload),
      };
    case 'NEXT_ACTION':
      return {
        ...base,
        type: row.type,
        payload: SUGGESTION_PAYLOAD_SCHEMAS.NEXT_ACTION.parse(row.payload),
        finalPayload:
          row.finalPayload === null
            ? null
            : SUGGESTION_FINAL_SCHEMAS.NEXT_ACTION.parse(row.finalPayload),
      };
    case 'LINE_REPLY':
      return {
        ...base,
        type: row.type,
        payload: SUGGESTION_PAYLOAD_SCHEMAS.LINE_REPLY.parse(row.payload),
        finalPayload:
          row.finalPayload === null
            ? null
            : SUGGESTION_FINAL_SCHEMAS.LINE_REPLY.parse(row.finalPayload),
      };
  }
}

export async function listSuggestions(
  prisma: PrismaClient,
  leadId: string,
  status?: AiSuggestionStatus,
): Promise<AiSuggestion[]> {
  const rows = await prisma.aiSuggestion.findMany({
    where: { leadId, ...(status ? { status } : {}) },
    select: suggestionSelect,
    orderBy: [{ createdAt: 'desc' }, { type: 'asc' }],
    take: 30,
  });
  return rows.map(toAiSuggestion);
}

async function getSuggestion(prisma: PrismaClient, id: string): Promise<AiSuggestion> {
  const row = await prisma.aiSuggestion.findUnique({ where: { id }, select: suggestionSelect });
  if (!row) throw notFound('AI suggestion');
  return toAiSuggestion(row);
}

/**
 * ขอคำแนะนำจาก crm-copilot แล้วบันทึกเป็น PENDING ทั้งหมด — ไม่แตะข้อมูล lead / ไม่ส่งข้อความ
 * ชุดเดิมที่ยังรออยู่กลายเป็น SUPERSEDED (partial unique index กันไม่ให้มี PENDING ซ้อน)
 * requestedBy = null คือระบบขอเองจากข้อความ LINE ที่เข้ามา
 */
export async function generateSuggestions(
  deps: AiDeps,
  leadId: string,
  requestedBy: AuthUser | null,
): Promise<AiSuggestion[]> {
  const input = await buildCopilotInput(deps.prisma, leadId);
  const result = await runCrmCopilot(input, deps.copilot);
  const { output } = result;
  const common = {
    leadId,
    source: result.source,
    aiModel: result.aiModel,
    promptVersion: result.promptVersion,
    fallbackReason: result.fallbackReason,
    latencyMs: result.latencyMs,
    requestedById: requestedBy?.id ?? null,
  } as const;

  const rows: Prisma.AiSuggestionCreateManyInput[] = [
    {
      ...common,
      type: 'QUALIFICATION',
      payload: {
        summary: output.summary,
        score: output.qualification.score,
        reasons: output.qualification.reasons,
        confidence: output.qualification.confidence,
        flags: output.flags,
      },
    },
    { ...common, type: 'NEXT_ACTION', payload: output.nextBestAction },
    ...(output.lineReply
      ? [
          {
            ...common,
            type: 'LINE_REPLY' as const,
            payload: { text: output.lineReply.text, flags: output.flags },
          },
        ]
      : []),
  ];

  await withPrismaErrors(
    deps.prisma.$transaction(async (tx) => {
      await tx.aiSuggestion.updateMany({
        where: { leadId, status: 'PENDING' },
        data: { status: 'SUPERSEDED' },
      });
      await tx.aiSuggestion.createMany({ data: rows });
    }),
    {
      P2002: () =>
        new HttpError(
          409,
          'CONFLICT',
          'AI is already preparing suggestions for this lead — try again',
        ),
    },
  );

  deps.logger.info(
    {
      leadId,
      source: result.source,
      aiModel: result.aiModel,
      latencyMs: result.latencyMs,
      fallbackReason: result.fallbackReason,
      fallbackDetail: result.fallbackDetail,
      usage: result.usage,
      flags: output.flags,
      suggestions: rows.length,
    },
    'ai suggestions generated',
  );
  return listSuggestions(deps.prisma, leadId, 'PENDING');
}

function conflict(message: string): HttpError {
  return new HttpError(409, 'CONFLICT', message);
}

const APPROVED_LABEL = {
  QUALIFICATION: 'อนุมัติคะแนนและสรุปจาก AI',
  NEXT_ACTION: 'อนุมัติงานถัดไปที่ AI แนะนำ',
  LINE_REPLY: 'อนุมัติข้อความตอบ LINE ที่ AI ร่าง',
} as const;

/**
 * จุดเดียวที่คำแนะนำของ AI กลายเป็นข้อมูลจริง — ต้องมีคนกดเท่านั้น
 * 1) จอง PENDING → APPROVED แบบมีเงื่อนไข (กด approve ซ้ำ / พร้อมกัน = 409 ไม่เกิดผลซ้ำ)
 * 2) เขียนผลตามประเภท + Activity AI_APPROVED ใน transaction เดียว
 * 3) LINE_REPLY: ส่งหลัง commit (ไม่ถือ transaction ค้างระหว่างรอ network)
 */
export async function approveSuggestion(
  deps: AiDeps,
  suggestionId: string,
  input: AiSuggestionApproveInput,
  actor: AuthUser,
): Promise<AiSuggestionDecision> {
  const row = await deps.prisma.aiSuggestion.findUnique({
    where: { id: suggestionId },
    select: {
      ...suggestionSelect,
      lead: { select: { score: true, contactId: true, contact: { select: { lineUserId: true } } } },
    },
  });
  if (!row) throw notFound('AI suggestion');
  if (row.status !== 'PENDING') throw conflict(`This suggestion is already ${row.status}`);

  const allowed: readonly string[] = APPROVE_FIELDS[row.type];
  const invalidField = Object.entries(input).find(
    ([field, value]) => value !== undefined && !allowed.includes(field),
  );
  if (invalidField) {
    throw validationError('Invalid request body', [
      { path: invalidField[0], message: `Not editable for ${row.type} suggestions` },
    ]);
  }
  if (row.type === 'LINE_REPLY' && !row.lead.contact.lineUserId) {
    throw conflict('The contact is not linked to LINE — the reply cannot be sent');
  }

  const suggestion = toAiSuggestion(row);
  const now = new Date();
  let messageId: string | null = null;

  await deps.prisma.$transaction(async (tx) => {
    const claim = async (finalPayload: Prisma.InputJsonValue) => {
      const { count } = await tx.aiSuggestion.updateMany({
        where: { id: suggestionId, status: 'PENDING' },
        data: { status: 'APPROVED', reviewedById: actor.id, reviewedAt: now, finalPayload },
      });
      if (count === 0) throw conflict('This suggestion was already decided or replaced');
    };
    let edited = false;
    let changes: Prisma.InputJsonObject | undefined;
    let body: string = APPROVED_LABEL[suggestion.type];

    switch (suggestion.type) {
      case 'QUALIFICATION': {
        const final = {
          score: input.score ?? suggestion.payload.score,
          summary: input.summary ?? suggestion.payload.summary,
        };
        edited =
          final.score !== suggestion.payload.score || final.summary !== suggestion.payload.summary;
        await claim(final);
        await tx.lead.update({
          where: { id: row.leadId },
          data: { score: final.score, summary: final.summary },
        });
        changes = { score: { from: row.lead.score, to: final.score } };
        break;
      }
      case 'NEXT_ACTION': {
        const dueAt =
          input.dueAt ??
          new Date(now.getTime() + suggestion.payload.dueInDays * DAY_MS).toISOString();
        const final = { action: input.action ?? suggestion.payload.action, dueAt };
        edited = final.action !== suggestion.payload.action || input.dueAt !== undefined;
        await claim(final);
        await tx.activity.create({
          data: {
            leadId: row.leadId,
            type: 'TASK',
            body: final.action,
            dueAt: new Date(dueAt),
            actorId: actor.id,
          },
        });
        body = `${APPROVED_LABEL.NEXT_ACTION}: ${final.action}`;
        break;
      }
      case 'LINE_REPLY': {
        const final = { text: input.text ?? suggestion.payload.text };
        edited = final.text !== suggestion.payload.text;
        await claim(final);
        const message = await tx.message.create({
          data: {
            leadId: row.leadId,
            contactId: row.lead.contactId,
            direction: 'OUTBOUND',
            channel: 'LINE',
            status: 'QUEUED',
            text: final.text,
            retryKey: randomUUID(),
            sentById: actor.id,
            aiSuggestionId: suggestionId,
          },
          select: { id: true },
        });
        messageId = message.id;
        break;
      }
    }

    await tx.activity.create({
      data: {
        leadId: row.leadId,
        type: 'AI_APPROVED',
        body,
        actorId: actor.id,
        createdAt: now,
        metadata: {
          suggestionId,
          suggestionType: suggestion.type,
          source: suggestion.source,
          edited,
          ...(changes ? { changes } : {}),
        },
      },
    });
  });

  deps.logger.info(
    { suggestionId, type: suggestion.type, actorId: actor.id },
    'ai suggestion approved',
  );

  let message = null;
  if (messageId) {
    await deliverMessage(
      {
        prisma: deps.prisma,
        line: deps.line,
        logger: deps.logger,
        retryDelaysMs: deps.lineRetryDelaysMs,
      },
      messageId,
    );
    const sent = await deps.prisma.message.findUnique({
      where: { id: messageId },
      select: messageSelect,
    });
    message = sent ? toMessage(sent) : null;
  }
  return { suggestion: await getSuggestion(deps.prisma, suggestionId), message };
}

export async function rejectSuggestion(
  deps: AiDeps,
  suggestionId: string,
  input: AiSuggestionRejectInput,
  actor: AuthUser,
): Promise<AiSuggestionDecision> {
  const row = await deps.prisma.aiSuggestion.findUnique({
    where: { id: suggestionId },
    select: { leadId: true, type: true, status: true },
  });
  if (!row) throw notFound('AI suggestion');
  const reason = input.reason ?? null;

  await deps.prisma.$transaction(async (tx) => {
    const { count } = await tx.aiSuggestion.updateMany({
      where: { id: suggestionId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        reviewedById: actor.id,
        reviewedAt: new Date(),
        rejectReason: reason,
      },
    });
    if (count === 0) throw conflict(`This suggestion is already ${row.status}`);
    await tx.activity.create({
      data: {
        leadId: row.leadId,
        type: 'AI_REJECTED',
        body: reason,
        actorId: actor.id,
        metadata: { suggestionId, suggestionType: row.type, ...(reason ? { reason } : {}) },
      },
    });
  });

  deps.logger.info({ suggestionId, type: row.type, actorId: actor.id }, 'ai suggestion rejected');
  return { suggestion: await getSuggestion(deps.prisma, suggestionId), message: null };
}
