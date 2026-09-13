'use client';

import { LEAD_STAGES, type LeadListItem, type LeadStage } from '@ai-crm/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { StageActions } from '@/components/stage';
import { Button, cx, ErrorState, PageHeader, Spinner } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { formatMoney, formatMoneyCompact, formatRelative, initials } from '@/lib/format';
import { STAGE_META } from '@/lib/labels';
import { queryKeys, useLeadList } from '@/lib/queries';

function PipelineCard({ lead }: { lead: LeadListItem }) {
  return (
    <li className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <Link
        href={`/leads/${lead.id}`}
        className="block text-sm font-medium text-slate-900 hover:text-indigo-700"
      >
        {lead.title}
      </Link>
      <p className="mt-0.5 truncate text-xs text-slate-500">
        {lead.company?.name ?? lead.contact.name}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium tabular-nums text-slate-700">{formatMoney(lead.value)}</span>
        <span className="text-slate-400">{formatRelative(lead.updatedAt)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={cx(
            'flex size-6 items-center justify-center rounded-full text-[10px] font-semibold',
            lead.owner ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800',
          )}
          title={lead.owner?.name ?? 'ยังไม่มีผู้รับผิดชอบ'}
        >
          {lead.owner ? initials(lead.owner.name) : '?'}
        </span>
        <StageActions leadId={lead.id} stage={lead.stage} compact />
      </div>
    </li>
  );
}

function PipelineColumn({
  stage,
  owner,
  count,
  totalValue,
}: {
  stage: LeadStage;
  owner: string;
  count: number | undefined;
  totalValue: number | undefined;
}) {
  const meta = STAGE_META[stage];
  const leads = useLeadList(
    { stage: [stage], ownerId: owner, sort: 'updatedAt', order: 'desc' },
    { limit: 20 },
  );
  const items = leads.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section
      aria-label={meta.label}
      className="flex w-72 shrink-0 snap-start flex-col rounded-xl bg-slate-100/80 p-2"
    >
      <header className="flex items-baseline justify-between px-1 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden="true" />
          {meta.label}
          <span className="font-normal text-slate-500">{count ?? '…'}</span>
        </h2>
        <span className="text-xs tabular-nums text-slate-500">
          {totalValue === undefined ? '' : formatMoneyCompact(totalValue)}
        </span>
      </header>
      {leads.isPending ? (
        <div className="flex justify-center py-6 text-slate-400">
          <Spinner />
        </div>
      ) : leads.isError ? (
        <ErrorState message={errorMessage(leads.error)} onRetry={() => void leads.refetch()} />
      ) : items.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-slate-400">ไม่มี lead</p>
      ) : (
        <ul className="space-y-2">
          {items.map((lead) => (
            <PipelineCard key={lead.id} lead={lead} />
          ))}
        </ul>
      )}
      {leads.hasNextPage ? (
        <Button
          variant="ghost"
          className="mt-2 text-xs"
          loading={leads.isFetchingNextPage}
          onClick={() => void leads.fetchNextPage()}
        >
          โหลดเพิ่ม
        </Button>
      ) : null}
    </section>
  );
}

export function PipelineView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const owner = searchParams.get('owner') === 'me' ? 'me' : '';
  const summary = useQuery({
    queryKey: queryKeys.pipeline(owner || 'all'),
    queryFn: () => api.leads.pipeline({ ownerId: owner }),
  });

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="ย้าย stage ได้จากเมนูบนการ์ด — Lost ต้องระบุเหตุผล"
        actions={
          <div
            className="inline-flex rounded-md bg-slate-200/70 p-1"
            role="radiogroup"
            aria-label="แสดง lead ของ"
          >
            {[
              { value: '', label: 'ทั้งทีม' },
              { value: 'me', label: 'ของฉัน' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={owner === option.value}
                onClick={() => router.replace(option.value ? `${pathname}?owner=me` : pathname)}
                className={cx(
                  'rounded px-3 py-1.5 text-sm',
                  owner === option.value
                    ? 'bg-white font-medium text-slate-900 shadow-sm'
                    : 'text-slate-600',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />
      {summary.isError ? (
        <ErrorState message={errorMessage(summary.error)} onRetry={() => void summary.refetch()} />
      ) : null}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        {LEAD_STAGES.map((stage) => {
          const stats = summary.data?.stages.find((row) => row.stage === stage);
          return (
            <PipelineColumn
              key={`${stage}-${owner}`}
              stage={stage}
              owner={owner}
              count={stats?.count}
              totalValue={stats?.totalValue}
            />
          );
        })}
      </div>
    </>
  );
}
