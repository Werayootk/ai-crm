'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AdminDeleteButton } from '@/components/delete-button';
import { Dialog } from '@/components/dialog';
import { ContactForm } from '@/components/entity-forms';
import { LeadList } from '@/components/lead-list';
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
import { api } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queries';

export function ContactDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const contact = useQuery({
    queryKey: queryKeys.contact(id),
    queryFn: () => api.contacts.get(id),
  });

  if (contact.isPending) return <Loading />;
  if (contact.isError) {
    return contact.error instanceof ApiError && contact.error.status === 404 ? (
      <Card>
        <EmptyState title="ไม่พบผู้ติดต่อนี้" />
      </Card>
    ) : (
      <ErrorState message={errorMessage(contact.error)} onRetry={() => void contact.refetch()} />
    );
  }
  const data = contact.data;

  return (
    <>
      <Link
        href="/contacts"
        className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-800"
      >
        ← Contacts
      </Link>
      <PageHeader
        title={data.name}
        description={[data.jobTitle, data.company?.name].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <ButtonLink href={`/leads/new?contactId=${data.id}`}>สร้าง lead</ButtonLink>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              แก้ไข
            </Button>
            <AdminDeleteButton
              label="ลบผู้ติดต่อ"
              description={`ลบ "${data.name}" ถาวร — ถ้ายังมี lead หรือข้อความของผู้ติดต่อนี้ ระบบจะไม่ยอมลบ`}
              onDelete={() => api.contacts.remove(data.id)}
              onDeleted={() => router.replace('/contacts')}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="ข้อมูลติดต่อ" />
          <dl className="space-y-3 px-4 py-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">อีเมล</dt>
              <dd>
                {data.email ? (
                  <a href={`mailto:${data.email}`} className="text-indigo-700 hover:underline">
                    {data.email}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">เบอร์โทร</dt>
              <dd>
                {data.phone ? (
                  <a href={`tel:${data.phone}`} className="text-indigo-700 hover:underline">
                    {data.phone}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">บริษัท</dt>
              <dd>
                {data.company ? (
                  <Link
                    href={`/companies/${data.company.id}`}
                    className="text-indigo-700 hover:underline"
                  >
                    {data.company.name}
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">LINE</dt>
              <dd className="mt-0.5">
                {data.line.linked ? (
                  <Badge className="bg-green-50 text-green-700 ring-green-200">
                    เชื่อมแล้ว: {data.line.displayName ?? '—'}
                  </Badge>
                ) : (
                  <Badge>ยังไม่เชื่อม</Badge>
                )}
              </dd>
            </div>
          </dl>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={`Leads (${data.leads.length})`} />
          {data.leads.length === 0 ? (
            <EmptyState title="ยังไม่มี lead ของผู้ติดต่อนี้" />
          ) : (
            <LeadList leads={data.leads} />
          )}
        </Card>
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title="แก้ไขผู้ติดต่อ">
        <ContactForm
          contact={data}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </Dialog>
    </>
  );
}
