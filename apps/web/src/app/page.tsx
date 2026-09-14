import { redirect } from 'next/navigation';
import { HOME_PATH } from '@/lib/navigation';

export default function RootPage() {
  redirect(HOME_PATH);
}
