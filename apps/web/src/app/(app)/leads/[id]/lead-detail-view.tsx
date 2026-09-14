'use client';

import type { LeadDetail } from '@ai-crm/shared';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { StageActions, StageBadge } from '@/components/stage';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
} from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDateTime, formatMoney, formatRelative } from '@/lib/format';
import { SOURCE_LABEL, STAGE_META } from '@/lib/labels';
import { useLead } from '@/lib/queries';
import { LeadEditDialog } from './lead-edit-dialog';
import { AiPanel } from './ai-panel';
import { LineComposer } from './line-composer';
import { AddActivityForm, Timeline } from './timeline';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function ContactCard({ contact }: { contact: LeadDetail['contact'] }) {
  return (
    <Card>
      <CardHeader
        title="ผู้ติดต่อ"
        action={
          <Link
            href={`/contacts/${contact.id}`}
            className="text-xs font-medium text-indigo-700 hover:underline"
          >
            ดูข้อมูล
          </Link>
        }
      />
      <div className="space-y-1.5 px-4 py-3 text-sm">
        <p className="font-medium text-slate-900">{contact.name}</p>
        {contact.jobTitle ? <p className="text-slate-500">{contact.jobTitle}</p> : null}
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="block truncate text-indigo-700 hover:underline"
          >
            {contact.email}
          </a>
        ) : null}
        {contact.phone ? (
          <a href={`tel:${contact.phone}`} className="block text-indigo-700 hover:underline">
            {contact.phone}
          </a>
        ) : null}
        <div className="pt-1">
          {contact.line.linked ? (
            <Badge className="bg-green-50 text-green-700 ring-green-200">
              LINE: {contact.line.displayName ?? 'เชื่อมแล้ว'}
            </Badge>
          ) : (
            <Badge>ยังไม่ได้เชื่อม LINE</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

export function LeadDetailView({ id }: { id: string }) {
  const lead = useLead(id);
  const [editing, setEditing] = useState(false);

  if (lead.isPending) return <Loading />;
  if (lead.isError) {
    if (lead.error instanceof ApiError && lead.error.status === 404) {
      return (
        <Card>
          <EmptyState title="ไม่พบ lead นี้">
            <ButtonLink href="/leads" variant="secondary" className="mt-3">
              กลับไปหน้า Leads
            </ButtonLink>
          </EmptyState>
        </Card>
      );
    }
    return <ErrorState message={errorMessage(lead.error)} onRetry={() => void lead.refetch()} />;
  }

  const data = lead.data;
  const closed = data.stage === 'WON' || data.stage === 'LOST';

  return (
    <>
      <Link href="/leads" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Leads
      </Link>
      <PageHeader
        title={data.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StageBadge stage={data.stage} />
            <span>{SOURCE_LABEL[data.source]}</span>
            <span aria-hidden="true">·</span>
            <span>สร้างเมื่อ {formatDateTime(data.createdAt)}</span>
          </span>
        }
        actions={
          <Button variant="secondary" onClick={() => setEditing(true)}>
            แก้ไข
          </Button>
        }
      />

      <Card className="mb-6 p-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label="มูลค่าดีล">{formatMoney(data.value)}</Fact>
          <Fact label="คะแนน">{data.score ?? '—'}</Fact>
          <Fact label="ผู้รับผิดชอบ">{data.owner?.name ?? 'ยังไม่มี'}</Fact>
          <Fact label={closed ? 'ปิดเมื่อ' : `อยู่ใน ${STAGE_META[data.stage].label} มา`}>
            {closed && data.closedAt
              ? formatDateTime(data.closedAt)
              : formatRelative(data.stageChangedAt)}
          </Fact>
        </dl>
        {data.stage === 'LOST' && data.lostReason ? (
          <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
            เหตุผลที่ไม่ได้งาน: {data.lostReason}
          </p>
        ) : null}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <StageActions leadId={data.id} stage={data.stage} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AiPanel leadId={data.id} />
          {data.contact.line.linked ? <LineComposer leadId={data.id} /> : null}
          <AddActivityForm leadId={data.id} />
          <Timeline leadId={data.id} />
        </div>
        <div className="space-y-6">
          <ContactCard contact={data.contact} />
          <Card>
            <CardHeader title="บริษัท" />
            <div className="px-4 py-3 text-sm">
              {data.company ? (
                <>
                  <Link
                    href={`/companies/${data.company.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {data.company.name}
                  </Link>
                  <p className="text-slate-500">
                    {[data.company.industry, data.company.domain].filter(Boolean).join(' · ') ||
                      '—'}
                  </p>
                </>
              ) : (
                <p className="text-slate-500">ไม่ได้ผูกกับบริษัท</p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="สรุป" />
            <p className="whitespace-pre-wrap px-4 py-3 text-sm text-slate-700">
              {data.summary ?? <span className="text-slate-400">ยังไม่มีสรุป</span>}
            </p>
          </Card>
        </div>
      </div>

      <LeadEditDialog lead={data} open={editing} onClose={() => setEditing(false)} />
    </>
  );
}
