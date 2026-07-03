import type { ReactNode } from 'react';

import { requireServerAuth } from '@/lib/server-auth';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  requireServerAuth();
  return children;
}
