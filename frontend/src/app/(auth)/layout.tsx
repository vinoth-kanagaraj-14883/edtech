import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { redirectIfAuthenticated } from '@/lib/server-auth';

interface AuthLayoutProps {
  children: ReactNode;
}

const HIGHLIGHTS = [
  'Expert-led courses across cloud, data, AI and security',
  'Hundreds of practice quizzes with instant feedback',
  'Track progress and earn a shareable certificate'
];

export default function AuthLayout({ children }: AuthLayoutProps) {
  redirectIfAuthenticated('/dashboard');

  return (
    <div className="grid min-h-[calc(100vh-14rem)] items-stretch gap-10 lg:grid-cols-2">
      {/* Brand panel — decorative, hidden on small screens. */}
      <aside className="relative isolate hidden overflow-hidden rounded-4xl bg-brand-gradient p-10 lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-mesh opacity-70" />

        <Link href="/" className="flex w-fit items-center gap-2 text-lg font-extrabold tracking-tight text-white">
          <Image src="/logo.png" alt="" width={40} height={40} className="h-9 w-9 rounded-xl object-contain" />
          EduForge
        </Link>

        <div className="space-y-6">
          <h2 className="text-display text-white">Learn without limits</h2>
          <p className="max-w-sm text-base leading-relaxed text-white/90">
            Build in-demand skills with hands-on lessons, then prove them with quizzes and certificates.
          </p>
          <ul className="space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/90">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20"
                  aria-hidden="true"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m20 6-11 11-5-5" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/70">Trusted by 17,000+ companies worldwide</p>
      </aside>

      {/* Form column */}
      <div className="flex items-center justify-center py-6">
        <div className="w-full max-w-md animate-fade-up">{children}</div>
      </div>
    </div>
  );
}
