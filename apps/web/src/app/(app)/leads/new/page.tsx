import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loading } from '@/components/ui';
import { NewLeadForm } from './new-lead-form';

export const metadata: Metadata = { title: 'สร้าง lead' };

export default function NewLeadPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewLeadForm />
    </Suspense>
  );
}
