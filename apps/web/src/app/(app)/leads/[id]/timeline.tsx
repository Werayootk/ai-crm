'use client';

import {
  activityCreateInputSchema,
  leadStageSchema,
  MANUAL_ACTIVITY_TYPES,
  type ManualActivityType,
  type TimelineItem,
} from '@ai-crm/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { StageBadge } from '@/components/stage';
import { useToast } from '@/components/toast';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  cx,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Textarea,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { apiFieldErrors, validate, type FieldErrors } from '@/lib/form';
import { formatDateTime, formatMoney, formatRelative } from '@/lib/format';
import { ACTIVITY_LABEL, MESSAGE_STATUS_LABEL } from '@/lib/labels';
import { useInvalidateLeads, useTimeline, useUsers } from '@/lib/queries';

// metadata ของ activity เป็น JSON อิสระ — parse ก่อนแสดง ไม่เดารูปแบบ
const stageChangeMeta = z.object({
  from: leadStageSchema,
  to: leadStageSchema,
  lostReason: z.string().optional(),
});
const changeValue = z.union([z.string(), z.number(), z.null()]);
const fieldChangesMeta = z.object({
  changes: z.record(z.string(), z.object({ from: changeValue, to: changeValue })),
});

const FIELD_LABEL: Record<string, string> = {
  ownerId: 'ผู้รับผิดชอบ',
  score: 'คะแนน',
  value: 'มูลค่าดีล',
};

type ActivityItem = Extract<TimelineItem, { kind: 'activity' }>;
type MessageItem = Extract<TimelineItem, { kind: 'message' }>;

function FieldChanges({ metadata }: { metadata: ActivityItem['metadata'] }) {
  const users = useUsers();
  const parsed = fieldChangesMeta.safeParse(metadata);
  if (!parsed.success) return null;
  const userName = (id: string | number | null) =>
    id === null
      ? 'ยังไม่มี'
      : (users.data?.items.find((user) => user.id === id)?.name ?? String(id));
  const show = (field: string, value: string | number | null) =>
    field === 'ownerId'
      ? userName(value)
      : field === 'value'
        ? formatMoney(typeof value === 'number' ? value : null)
        : (value ?? '—');

  return (
    <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
      {Object.entries(parsed.data.changes).map(([field, change]) => (
        <li key={field}>
          {FIELD_LABEL[field] ?? field}: {show(field, change.from)} →{' '}
          <strong>{show(field, change.to)}</strong>
        </li>
      ))}
    </ul>
  );
}

function ActivityEntry({ item, leadId }: { item: ActivityItem; leadId: string }) {
  const invalidate = useInvalidateLeads();
  const toast = useToast();
  const complete = useMutation({
    mutationFn: () => api.activities.complete(item.id),
    onSuccess: () => invalidate(leadId),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const stageChange =
    item.type === 'STAGE_CHANGE' ? stageChangeMeta.safeParse(item.metadata) : null;

  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-700">{ACTIVITY_LABEL[item.type]}</span>
        {' · '}
        {item.actor?.name ?? 'ระบบ'}
        {' · '}
        <time dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>
          {formatRelative(item.createdAt)}
        </time>
      </p>
      {stageChange?.success ? (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <StageBadge stage={stageChange.data.from} />→<StageBadge stage={stageChange.data.to} />
          {stageChange.data.lostReason ? (
            <span className="text-slate-600">เหตุผล: {stageChange.data.lostReason}</span>
          ) : null}
        </div>
      ) : null}
      {item.body ? (
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{item.body}</p>
      ) : null}
      {item.type === 'SYSTEM' ? <FieldChanges metadata={item.metadata} /> : null}
      {item.type === 'TASK' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {item.dueAt ? <Badge>กำหนด {formatDateTime(item.dueAt)}</Badge> : null}
          {item.completedAt ? (
            <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
              เสร็จแล้ว {formatRelative(item.completedAt)}
            </Badge>
          ) : (
            <Button
              variant="secondary"
              className="px-2 py-1 text-xs"
              loading={complete.isPending}
              onClick={() => complete.mutate()}
            >
              ทำเสร็จแล้ว
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MessageEntry({ item }: { item: MessageItem }) {
  const inbound = item.direction === 'INBOUND';
  return (
    <div className={cx('flex min-w-0 flex-1', inbound ? 'justify-start' : 'justify-end')}>
      <div
        className={cx(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
          inbound
            ? 'rounded-tl-sm bg-slate-100 text-slate-800'
            : 'rounded-tr-sm bg-indigo-600 text-white',
        )}
      >
        <p className="whitespace-pre-wrap">{item.text}</p>
        <p className={cx('mt-1 text-[11px]', inbound ? 'text-slate-500' : 'text-indigo-100')}>
          {item.channel === 'LINE' ? 'LINE' : 'ฟอร์มเว็บ'}
          {inbound
            ? ''
            : ` · ${item.sentBy?.name ?? 'ระบบ'} · ${MESSAGE_STATUS_LABEL[item.status]}`}
          {item.fromAiSuggestion ? ' · ร่างโดย AI' : ''}
          {' · '}
          <time dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>
            {formatRelative(item.createdAt)}
          </time>
        </p>
      </div>
    </div>
  );
}

export function Timeline({ leadId }: { leadId: string }) {
  const timeline = useTimeline(leadId);
  const items = timeline.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Card>
      <CardHeader title="Timeline" />
      {timeline.isPending ? (
        <Loading />
      ) : timeline.isError ? (
        <div className="p-4">
          <ErrorState
            message={errorMessage(timeline.error)}
            onRetry={() => void timeline.refetch()}
          />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="ยังไม่มีความเคลื่อนไหว" />
      ) : (
        <ol className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex gap-3 px-4 py-3">
              {item.kind === 'activity' ? (
                <ActivityEntry item={item} leadId={leadId} />
              ) : (
                <MessageEntry item={item} />
              )}
            </li>
          ))}
        </ol>
      )}
      {timeline.hasNextPage ? (
        <div className="border-t border-slate-100 p-3 text-center">
          <Button
            variant="secondary"
            loading={timeline.isFetchingNextPage}
            onClick={() => void timeline.fetchNextPage()}
          >
            ดูเก่ากว่านี้
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/** datetime-local ของ browser เป็นเวลาท้องถิ่นไม่มี timezone → แปลงเป็น ISO (UTC) ก่อนส่ง */
function localDateTimeToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function AddActivityForm({ leadId }: { leadId: string }) {
  const [type, setType] = useState<ManualActivityType>('NOTE');
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const invalidate = useInvalidateLeads();
  const toast = useToast();
  const add = useMutation({
    mutationFn: (input: z.input<typeof activityCreateInputSchema>) =>
      api.leads.addActivity(leadId, input),
    onSuccess: () => {
      setBody('');
      setDueAt('');
      setErrors({});
      toast.success('บันทึกแล้ว');
      return invalidate(leadId);
    },
    onError: (error) => {
      const fieldErrors = apiFieldErrors(error);
      if (fieldErrors) setErrors(fieldErrors);
      else toast.error(errorMessage(error));
    },
  });

  return (
    <Card className="p-4">
      <form
        noValidate
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const result = validate(activityCreateInputSchema, {
            type,
            body,
            dueAt: type === 'TASK' ? localDateTimeToIso(dueAt) : undefined,
          });
          setErrors(result.ok ? {} : result.errors);
          if (result.ok) add.mutate(result.data);
        }}
      >
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ประเภท">
          {MANUAL_ACTIVITY_TYPES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={type === option}
              onClick={() => setType(option)}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-medium',
                type === option
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
              )}
            >
              {ACTIVITY_LABEL[option]}
            </button>
          ))}
        </div>
        <Field label="รายละเอียด" htmlFor="activity-body" error={errors.body}>
          <Textarea
            id="activity-body"
            maxLength={2000}
            placeholder={
              type === 'TASK' ? 'เช่น ส่งใบเสนอราคาฉบับแก้ไข' : 'สรุปสิ่งที่คุยกับลูกค้า…'
            }
            value={body}
            onChange={(event) => setBody(event.target.value)}
            aria-invalid={errors.body ? true : undefined}
          />
        </Field>
        {type === 'TASK' ? (
          <Field label="กำหนดเสร็จ" htmlFor="activity-due" error={errors.dueAt}>
            <Input
              id="activity-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </Field>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" loading={add.isPending}>
            บันทึกลง timeline
          </Button>
        </div>
      </form>
    </Card>
  );
}
