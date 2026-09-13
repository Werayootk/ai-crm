'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Dialog } from '@/components/dialog';
import { ContactForm } from '@/components/entity-forms';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  PageHeader,
  Select,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { useDebounced } from '@/lib/use-debounced';

export function ContactsView() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [line, setLine] = useState<'' | 'true' | 'false'>('');
  const [creating, setCreating] = useState(false);
  const q = useDebounced(text.trim(), 300);

  const contacts = useInfiniteQuery({
    queryKey: ['contacts', 'list', { q, line }],
    queryFn: ({ pageParam }) =>
      api.contacts.list({ q, hasLine: line, limit: 30, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const items = contacts.data?.pages.flatMap((page) => page.items) ?? [];
  const total = contacts.data?.pages[0]?.total;

  return (
    <>
      <PageHeader
        title="Contacts"
        description={
          total === undefined ? 'ผู้ติดต่อทั้งหมด' : `${total.toLocaleString('th-TH')} คน`
        }
        actions={<Button onClick={() => setCreating(true)}>เพิ่มผู้ติดต่อ</Button>}
      />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <Input
          type="search"
          aria-label="ค้นหาผู้ติดต่อ"
          placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="sm:col-span-2"
        />
        <Select
          aria-label="สถานะ LINE"
          value={line}
          onChange={(event) => {
            const value = event.target.value;
            setLine(value === 'true' || value === 'false' ? value : '');
          }}
        >
          <option value="">LINE: ทั้งหมด</option>
          <option value="true">เชื่อม LINE แล้ว</option>
          <option value="false">ยังไม่เชื่อม LINE</option>
        </Select>
      </Card>

      <Card>
        {contacts.isPending ? (
          <Loading />
        ) : contacts.isError ? (
          <div className="p-4">
            <ErrorState
              message={errorMessage(contacts.error)}
              onRetry={() => void contacts.refetch()}
            />
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="ไม่พบผู้ติดต่อ" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((contact) => (
              <li key={contact.id}>
                <Link
                  href={`/contacts/${contact.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{contact.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[contact.jobTitle, contact.company?.name, contact.email, contact.phone]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  {contact.line.linked ? (
                    <Badge className="bg-green-50 text-green-700 ring-green-200">LINE</Badge>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {contacts.hasNextPage ? (
          <div className="border-t border-slate-100 p-3 text-center">
            <Button
              variant="secondary"
              loading={contacts.isFetchingNextPage}
              onClick={() => void contacts.fetchNextPage()}
            >
              โหลดเพิ่ม
            </Button>
          </div>
        ) : null}
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} title="เพิ่มผู้ติดต่อ">
        <ContactForm
          onCancel={() => setCreating(false)}
          onSaved={(contact) => router.push(`/contacts/${contact.id}`)}
        />
      </Dialog>
    </>
  );
}
