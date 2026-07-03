import type { ReactNode } from 'react';

import { redirectIfAuthenticated } from '@/lib/server-auth';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  redirectIfAuthenticated('/dashboard');

  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-xl items-center justify-center">
      <div className="w-full">{children}</div>
    </div>
  );
}
