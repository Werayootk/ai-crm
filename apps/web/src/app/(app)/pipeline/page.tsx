import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loading } from '@/components/ui';
import { PipelineView } from './pipeline-view';

export const metadata: Metadata = { title: 'Pipeline' };

export default function PipelinePage() {
  return (
    <Suspense fallback={<Loading />}>
      <PipelineView />
    </Suspense>
  );
}
