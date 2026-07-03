import { redirect } from 'next/navigation';

import { getServerUser } from '@/lib/server-auth';

export default function HomePage() {
  const user = getServerUser();
  redirect(user ? '/dashboard' : '/login');
}
