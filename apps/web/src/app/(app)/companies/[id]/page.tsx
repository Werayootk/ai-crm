import type { Metadata } from 'next';
import { CompanyDetailView } from './company-detail-view';

export const metadata: Metadata = { title: 'Company' };

export default async function CompanyPage(props: PageProps<'/companies/[id]'>) {
  const { id } = await props.params;
  return <CompanyDetailView id={id} />;
}
