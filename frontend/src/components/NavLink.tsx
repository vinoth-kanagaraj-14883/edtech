'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

interface NavLinkProps {
  href: string;
  children: ReactNode;
}

/**
 * Desktop nav item that highlights itself when it matches the current route.
 */
export default function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition dark:bg-brand-500/10 dark:text-brand-300'
          : 'rounded-lg px-3 py-1.5 text-sm font-semibold text-content-muted transition hover:bg-muted hover:text-content'
      }
    >
      {children}
    </Link>
  );
}
