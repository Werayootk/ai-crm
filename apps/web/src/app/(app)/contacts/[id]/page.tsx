import type { Metadata } from 'next';
import { ContactDetailView } from './contact-detail-view';

export const metadata: Metadata = { title: 'Contact' };

export default async function ContactPage(props: PageProps<'/contacts/[id]'>) {
  const { id } = await props.params;
  return <ContactDetailView id={id} />;
}
