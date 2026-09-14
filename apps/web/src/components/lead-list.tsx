import type { LeadListItem } from '@ai-crm/shared';
import Link from 'next/link';
import { formatMoney, formatRelative } from '@/lib/format';
import { SOURCE_LABEL } from '@/lib/labels';
import { StageBadge } from './stage';

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-400">—</span>;
  const tone = score >= 70 ? 'text-emerald-700' : score >= 40 ? 'text-amber-700' : 'text-slate-500';
  return <span className={`font-medium tabular-nums ${tone}`}>{score}</span>;
}

function subtitle(lead: LeadListItem): string {
  return lead.company ? `${lead.contact.name} · ${lead.company.name}` : lead.contact.name;
}

/** ตารางบนจอกว้าง / การ์ดบนมือถือ — ใช้ร่วมกันทั้งหน้า Leads, Contact และ Company */
export function LeadList({
  leads,
  showOwner = true,
}: {
  leads: LeadListItem[];
  showOwner?: boolean;
}) {
  return (
    <>
      <ul className="divide-y divide-slate-100 md:hidden">
        {leads.map((lead) => (
          <li key={lead.id}>
            <Link href={`/leads/${lead.id}`} className="block px-4 py-3 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">{lead.title}</p>
                <StageBadge stage={lead.stage} />
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle(lead)}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="tabular-nums">{formatMoney(lead.value)}</span>
                <span>
                  คะแนน <ScorePill score={lead.score} />
                </span>
                {showOwner ? <span>{lead.owner?.name ?? 'ยังไม่มีผู้รับผิดชอบ'}</span> : null}
                <span className="text-slate-400">{formatRelative(lead.updatedAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-2.5">
                Lead
              </th>
              <th scope="col" className="px-4 py-2.5">
                Stage
              </th>
              <th scope="col" className="px-4 py-2.5 text-right">
                มูลค่า
              </th>
              <th scope="col" className="px-4 py-2.5 text-right">
                คะแนน
              </th>
              {showOwner ? (
                <th scope="col" className="px-4 py-2.5">
                  ผู้รับผิดชอบ
                </th>
              ) : null}
              <th scope="col" className="px-4 py-2.5">
                ที่มา
              </th>
              <th scope="col" className="px-4 py-2.5">
                อัปเดต
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50">
                <td className="max-w-md px-4 py-3">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-slate-900 hover:text-indigo-700"
                  >
                    {lead.title}
                  </Link>
                  <p className="truncate text-xs text-slate-500">{subtitle(lead)}</p>
                </td>
                <td className="px-4 py-3">
                  <StageBadge stage={lead.stage} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(lead.value)}</td>
                <td className="px-4 py-3 text-right">
                  <ScorePill score={lead.score} />
                </td>
                {showOwner ? (
                  <td className="px-4 py-3 text-slate-600">
                    {lead.owner?.name ?? <span className="text-amber-700">ยังไม่มี</span>}
                  </td>
                ) : null}
                <td className="px-4 py-3 text-slate-600">{SOURCE_LABEL[lead.source]}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500" title={lead.updatedAt}>
                  {formatRelative(lead.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
