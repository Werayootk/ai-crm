'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AdminDeleteButton } from '@/components/delete-button';
import { Dialog } from '@/components/dialog';
import { CompanyForm } from '@/components/entity-forms';
import { LeadList } from '@/components/lead-list';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
} from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queries';

export function CompanyDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const company = useQuery({
    queryKey: queryKeys.company(id),
    queryFn: () => api.companies.get(id),
  });

  if (company.isPending) return <Loading />;
  if (company.isError) {
    return company.error instanceof ApiError && company.error.status === 404 ? (
      <Card>
        <EmptyState title="ไม่พบบริษัทนี้" />
      </Card>
    ) : (
      <ErrorState message={errorMessage(company.error)} onRetry={() => void company.refetch()} />
    );
  }
  const data = company.data;

  return (
    <>
      <Link
        href="/companies"
        className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-800"
      >
        ← Companies
      </Link>
      <PageHeader
        title={data.name}
        description={
          [
            data.industry,
            data.domain,
            data.employeeCount ? `${data.employeeCount.toLocaleString('th-TH')} คน` : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              แก้ไข
            </Button>
            <AdminDeleteButton
              label="ลบบริษัท"
              description={`ลบ "${data.name}" ถาวร — ถ้ายังมีผู้ติดต่อหรือ lead ของบริษัทนี้ ระบบจะไม่ยอมลบ`}
              onDelete={() => api.companies.remove(data.id)}
              onDeleted={() => router.replace('/companies')}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title={`ผู้ติดต่อ (${data.contacts.length})`} />
          {data.contacts.length === 0 ? (
            <EmptyState title="ยังไม่มีผู้ติดต่อ" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.contacts.map((contact) => (
                <li key={contact.id}>
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-slate-900">{contact.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {contact.jobTitle ?? contact.email ?? ''}
                      </span>
                    </span>
                    {contact.line.linked ? (
                      <Badge className="bg-green-50 text-green-700 ring-green-200">LINE</Badge>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={`Leads (${data.leads.length})`} />
          {data.leads.length === 0 ? (
            <EmptyState title="ยังไม่มี lead" />
          ) : (
            <LeadList leads={data.leads} />
          )}
        </Card>
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title="แก้ไขบริษัท">
        <CompanyForm
          company={data}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </Dialog>
    </>
  );
}
