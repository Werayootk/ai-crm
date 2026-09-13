'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Dialog } from '@/components/dialog';
import { CompanyForm } from '@/components/entity-forms';
import { Button, Card, EmptyState, ErrorState, Input, Loading, PageHeader } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { api } from '@/lib/endpoints';
import { useDebounced } from '@/lib/use-debounced';

export function CompaniesView() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [creating, setCreating] = useState(false);
  const q = useDebounced(text.trim(), 300);

  const companies = useInfiniteQuery({
    queryKey: ['companies', 'list', { q }],
    queryFn: ({ pageParam }) => api.companies.list({ q, limit: 30, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const items = companies.data?.pages.flatMap((page) => page.items) ?? [];
  const total = companies.data?.pages[0]?.total;

  return (
    <>
      <PageHeader
        title="Companies"
        description={
          total === undefined ? 'บริษัททั้งหมด' : `${total.toLocaleString('th-TH')} บริษัท`
        }
        actions={<Button onClick={() => setCreating(true)}>เพิ่มบริษัท</Button>}
      />
      <Card className="mb-4 p-4">
        <Input
          type="search"
          aria-label="ค้นหาบริษัท"
          placeholder="ค้นหาชื่อบริษัทหรือโดเมน…"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </Card>
      <Card>
        {companies.isPending ? (
          <Loading />
        ) : companies.isError ? (
          <div className="p-4">
            <ErrorState
              message={errorMessage(companies.error)}
              onRetry={() => void companies.refetch()}
            />
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="ไม่พบบริษัท" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((company) => (
              <li key={company.id}>
                <Link
                  href={`/companies/${company.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{company.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[company.industry, company.domain].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {company.contactCount} ผู้ติดต่อ · {company.leadCount} leads
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {companies.hasNextPage ? (
          <div className="border-t border-slate-100 p-3 text-center">
            <Button
              variant="secondary"
              loading={companies.isFetchingNextPage}
              onClick={() => void companies.fetchNextPage()}
            >
              โหลดเพิ่ม
            </Button>
          </div>
        ) : null}
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} title="เพิ่มบริษัท">
        <CompanyForm
          onCancel={() => setCreating(false)}
          onSaved={(company) => router.push(`/companies/${company.id}`)}
        />
      </Dialog>
    </>
  );
}
