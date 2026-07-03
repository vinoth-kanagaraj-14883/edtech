import Link from 'next/link';

import LogoutButton from '@/components/LogoutButton';
import { getServerUser } from '@/lib/server-auth';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/courses', label: 'Courses' },
  { href: '/quizzes', label: 'Quizzes' },
  { href: '/profile', label: 'Profile' }
];

export default function Navigation() {
  const user = getServerUser();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-semibold text-white">
            Polyglot <span className="text-brand-100">EdTech</span>
          </Link>
          {user ? (
            <div className="hidden items-center gap-5 md:flex">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="text-sm font-medium text-slate-300 hover:text-brand-100">
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{user.role}</p>
              </div>
              <LogoutButton />
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="secondary-button">
                Login
              </Link>
              <Link href="/register" className="primary-button">
                Create account
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
