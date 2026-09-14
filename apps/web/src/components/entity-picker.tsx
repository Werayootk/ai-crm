'use client';

import type { EntityRef } from '@ai-crm/shared';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { api } from '@/lib/endpoints';
import { useDebounced } from '@/lib/use-debounced';
import { Button, Input } from './ui';

const SEARCH = {
  contact: async (q: string): Promise<EntityRef[]> =>
    (await api.contacts.list({ q, limit: 8 })).items.map((contact) => ({
      id: contact.id,
      name: contact.company ? `${contact.name} · ${contact.company.name}` : contact.name,
    })),
  company: async (q: string): Promise<EntityRef[]> =>
    (await api.companies.list({ q, limit: 8 })).items.map(({ id, name }) => ({ id, name })),
};

/** ค้นหาแล้วเลือก contact / company (ค้นจาก API ไม่โหลดทั้งหมด — มี 2,000 contacts) */
export function EntityPicker({
  kind,
  id,
  value,
  onChange,
  invalid,
}: {
  kind: 'contact' | 'company';
  id: string;
  value: EntityRef | null;
  onChange: (value: EntityRef | null) => void;
  invalid?: boolean;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const q = useDebounced(text.trim());
  const listId = useId();
  const results = useQuery({
    queryKey: [kind, 'picker', q],
    queryFn: () => SEARCH[kind](q),
    enabled: open,
    staleTime: 30_000,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
        <span className="truncate">{value.name}</span>
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => onChange(null)}>
          เปลี่ยน
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid ? true : undefined}
        placeholder={kind === 'contact' ? 'พิมพ์ชื่อ อีเมล หรือเบอร์โทร…' : 'พิมพ์ชื่อบริษัท…'}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-slate-200"
        >
          {results.isPending ? (
            <li className="px-3 py-2 text-slate-500">กำลังค้นหา…</li>
          ) : results.data?.length ? (
            results.data.map((item) => (
              <li key={item.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-indigo-50"
                  // onMouseDown ทำงานก่อน blur ของ input
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onChange(item);
                    setText('');
                    setOpen(false);
                  }}
                >
                  {item.name}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-slate-500">ไม่พบข้อมูล</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
