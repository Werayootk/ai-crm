'use client';

import { healthResponseSchema, type HealthResponse } from '@ai-crm/shared';
import { useEffect, useState } from 'react';

type State =
  { kind: 'loading' } | { kind: 'ok'; health: HealthResponse } | { kind: 'error'; message: string };

export function HealthStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      try {
        // ผ่าน Next.js rewrite → apps/api
        const res = await fetch('/api/health', { signal: controller.signal, cache: 'no-store' });
        const parsed = healthResponseSchema.safeParse(await res.json());
        setState(
          parsed.success
            ? { kind: 'ok', health: parsed.data }
            : { kind: 'error', message: `API ตอบกลับผิดรูปแบบ (HTTP ${res.status})` },
        );
      } catch {
        if (!controller.signal.aborted) {
          setState({ kind: 'error', message: 'เชื่อมต่อ API ไม่ได้' });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  const apiOk = state.kind === 'ok';
  const dbOk = state.kind === 'ok' && state.health.db === 'up';

  return (
    <section
      aria-live="polite"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 16,
      }}
    >
      {state.kind === 'loading' ? (
        <p style={{ margin: 0 }}>กำลังตรวจสอบ…</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          <StatusRow label="API" ok={apiOk} />
          <StatusRow label="Database" ok={dbOk} />
          {state.kind === 'error' ? (
            <li style={{ color: 'var(--muted)', fontSize: 14 }}>{state.message}</li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <strong style={{ color: ok ? 'var(--ok)' : 'var(--bad)' }}>{ok ? 'OK' : 'DOWN'}</strong>
    </li>
  );
}
