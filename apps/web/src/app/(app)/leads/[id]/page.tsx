import type { Metadata } from 'next';
import { LeadDetailView } from './lead-detail-view';

export const metadata: Metadata = { title: 'Lead' };

export default async function LeadPage(props: PageProps<'/leads/[id]'>) {
  const { id } = await props.params;
  return <LeadDetailView id={id} />;
}
