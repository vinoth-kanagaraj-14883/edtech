'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface MobileNavLink {
  href: string;
  label: string;
}

interface MobileNavProps {
  links: MobileNavLink[];
  isAuthenticated: boolean;
}

/**
 * Slide-down mobile menu. Rendered alongside the desktop nav and only visible
 * below the `md` breakpoint.
 */
export default function MobileNav({ links, isAuthenticated }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the sheet whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Allow Escape to dismiss.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-surface text-content-muted shadow-xs transition hover:border-brand-300 hover:text-brand-600"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        )}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-[65px] z-40 cursor-default bg-ink-950/40 backdrop-blur-sm animate-fade-in"
          />
          <div
            id="mobile-nav-panel"
            className="absolute inset-x-0 top-full z-50 origin-top border-b border-hairline bg-surface p-4 shadow-lifted animate-fade-up"
          >
            <form action="/courses" className="mb-3">
              <label htmlFor="mobile-search" className="sr-only">
                Search courses
              </label>
              <input id="mobile-search" type="search" name="search" placeholder="Search courses…" />
            </form>

            <nav className="flex flex-col gap-1" aria-label="Mobile">
              <Link
                href="/courses"
                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-content-muted transition hover:bg-muted hover:text-content"
              >
                Explore
              </Link>
              {links.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'rounded-xl bg-brand-50 px-3 py-2.5 text-sm font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                        : 'rounded-xl px-3 py-2.5 text-sm font-semibold text-content-muted transition hover:bg-muted hover:text-content'
                    }
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {isAuthenticated ? null : (
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-hairline pt-4">
                <Link href="/login" className="secondary-button w-full">
                  Log in
                </Link>
                <Link href="/register" className="primary-button w-full">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
