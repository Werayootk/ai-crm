import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loading } from '@/components/ui';
import { LeadsView } from './leads-view';

export const metadata: Metadata = { title: 'Leads' };

export default function LeadsPage() {
  // LeadsView อ่าน filter จาก URL (useSearchParams) → ต้องอยู่ใน Suspense
  return (
    <Suspense fallback={<Loading />}>
      <LeadsView />
    </Suspense>
  );
}
