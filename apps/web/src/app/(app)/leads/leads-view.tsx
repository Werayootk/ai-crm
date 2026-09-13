'use client';

import { LEAD_SOURCES, LEAD_STAGES, type LeadStage } from '@ai-crm/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LeadList } from '@/components/lead-list';
import { StageBadge } from '@/components/stage';
import {
  Button,
  ButtonLink,
  Card,
  cx,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  PageHeader,
  Select,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { SOURCE_LABEL } from '@/lib/labels';
import {
  leadFiltersToQuery,
  parseLeadFilters,
  serializeLeadFilters,
  type LeadFilters,
} from '@/lib/lead-filters';
import { useLeadList, useUsers } from '@/lib/queries';

const SORT_OPTIONS = [
  { value: 'updatedAt:desc', label: 'อัปเดตล่าสุด' },
  { value: 'createdAt:desc', label: 'สร้างล่าสุด' },
  { value: 'value:desc', label: 'มูลค่าสูงสุด' },
  { value: 'score:desc', label: 'คะแนนสูงสุด' },
  { value: 'stageChangedAt:asc', label: 'ค้างใน stage นานสุด' },
] as const;

export function LeadsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = parseLeadFilters(new URLSearchParams(searchParams.toString()));
  const users = useUsers();
  const leads = useLeadList(leadFiltersToQuery(filters));

  // filter อยู่ใน URL → refresh / แชร์ลิงก์ได้ ได้ผลเหมือนเดิม
  // อ่าน URL ปัจจุบันตอนเรียก (ไม่ใช้ค่าจาก render) กันค้นหาแบบหน่วงเวลาไปทับ filter ที่เพิ่งกด
  function update(patch: Partial<LeadFilters>) {
    const current = parseLeadFilters(new URLSearchParams(window.location.search));
    const search = serializeLeadFilters({ ...current, ...patch });
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  // ช่องค้นหา: พิมพ์แล้วรอ 300ms ค่อยอัปเดต URL
  const [text, setText] = useState(filters.q);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(searchTimer.current), []);
  function onSearchChange(value: string) {
    setText(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => update({ q: value.trim() }), 300);
  }

  function toggleStage(stage: LeadStage) {
    const stages = filters.stages.includes(stage)
      ? filters.stages.filter((current) => current !== stage)
      : [...filters.stages, stage];
    update({ stages: LEAD_STAGES.filter((candidate) => stages.includes(candidate)) });
  }

  const items = leads.data?.pages.flatMap((page) => page.items) ?? [];
  const total = leads.data?.pages[0]?.total;

  return (
    <>
      <PageHeader
        title="Leads"
        description={
          total === undefined ? 'รายการ lead ทั้งหมด' : `${total.toLocaleString('th-TH')} รายการ`
        }
        actions={<ButtonLink href="/leads/new">สร้าง lead</ButtonLink>}
      />

      <Card className="mb-4 space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            type="search"
            aria-label="ค้นหา lead"
            placeholder="ค้นหาชื่อ lead, ลูกค้า, บริษัท…"
            value={text}
            onChange={(event) => onSearchChange(event.target.value)}
            className="lg:col-span-2"
          />
          <Select
            aria-label="ผู้รับผิดชอบ"
            value={filters.owner}
            onChange={(event) => update({ owner: event.target.value })}
          >
            <option value="">ผู้รับผิดชอบ: ทุกคน</option>
            <option value="me">ของฉัน</option>
            <option value="unassigned">ยังไม่มีผู้รับผิดชอบ</option>
            {users.data?.items.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="ที่มา"
            value={filters.source}
            onChange={(event) => {
              const source = LEAD_SOURCES.find((candidate) => candidate === event.target.value);
              update({ source: source ?? '' });
            }}
          >
            <option value="">ที่มา: ทุกช่องทาง</option>
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {SOURCE_LABEL[source]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="เรียงตาม"
            value={`${filters.sort}:${filters.order}`}
            onChange={(event) => {
              const option = SORT_OPTIONS.find(
                (candidate) => candidate.value === event.target.value,
              );
              if (!option) return;
              const [sort, order] = option.value.split(':') as [
                LeadFilters['sort'],
                LeadFilters['order'],
              ];
              update({ sort, order });
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                เรียง: {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {LEAD_STAGES.map((stage) => {
            const active = filters.stages.includes(stage);
            return (
              <button
                key={stage}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStage(stage)}
                className={cx(
                  'rounded-full transition',
                  active ? 'ring-2 ring-indigo-500 ring-offset-1' : 'opacity-70 hover:opacity-100',
                )}
              >
                <StageBadge stage={stage} />
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        {leads.isPending ? (
          <Loading />
        ) : leads.isError ? (
          <div className="p-4">
            <ErrorState message={errorMessage(leads.error)} onRetry={() => void leads.refetch()} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="ไม่พบ lead ตามเงื่อนไขนี้">ลองล้างตัวกรองหรือค้นด้วยคำอื่น</EmptyState>
        ) : (
          <>
            <LeadList leads={items} />
            {leads.hasNextPage ? (
              <div className="border-t border-slate-100 p-3 text-center">
                <Button
                  variant="secondary"
                  loading={leads.isFetchingNextPage}
                  onClick={() => void leads.fetchNextPage()}
                >
                  โหลดเพิ่ม
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}
