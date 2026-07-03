import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AUTH_COOKIE_NAME, getUserFromToken } from '@/lib/auth';

export const getServerToken = (): string | null =>
  cookies().get(AUTH_COOKIE_NAME)?.value ?? null;

export const getServerUser = () => getUserFromToken(getServerToken());

export const requireServerAuth = () => {
  const token = getServerToken();
  const user = getUserFromToken(token);

  if (!token || !user) {
    redirect('/login');
  }

  return { token, user };
};

export const redirectIfAuthenticated = (destination = '/dashboard') => {
  const user = getServerUser();

  if (user) {
    redirect(destination);
  }
};
