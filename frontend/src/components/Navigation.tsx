import Image from 'next/image';
import Link from 'next/link';

import LogoutButton from '@/components/LogoutButton';
import { getServerUser } from '@/lib/server-auth';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/courses', label: 'Courses' },
  { href: '/quizzes', label: 'Quizzes' },
  { href: '/profile', label: 'Profile' }
];

function SearchBar() {
  return (
    <form action="/courses" className="hidden flex-1 items-center lg:flex">
      <div className="relative w-full max-w-2xl">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-500">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="9" r="6" />
            <path d="m14 14 4 4" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          name="search"
          placeholder="Search for anything"
          aria-label="Search courses"
          className="w-full rounded-full border border-ink-900/80 bg-muted py-2.5 pl-11 pr-4 text-sm"
        />
      </div>
    </form>
  );
}

export default function Navigation() {
  const user = getServerUser();
  const navLinks = user?.role === 'instructor' ? [...links, { href: '/quizzes/create', label: 'Create quiz' }] : links;

  return (
    <header className="sticky top-0 z-50 border-b border-ink-300/70 bg-white shadow-nav">
      <nav className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-xl font-extrabold text-ink-900">
          <Image src="/logo.png" alt="EduForge" width={48} height={48} className="h-12 w-12 object-contain" priority />
          <span>
            Edu<span className="text-brand-500">Forge</span>
          </span>
        </Link>

        <Link
          href="/courses"
          className="hidden shrink-0 text-sm font-medium text-ink-700 hover:text-brand-600 xl:inline"
        >
          Explore
        </Link>

        <SearchBar />

        {user ? (
          <div className="hidden shrink-0 items-center gap-5 md:flex">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm font-medium text-ink-700 hover:text-brand-600">
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-ink-900">{user.name}</p>
                <p className="text-xs uppercase tracking-[0.14em] text-ink-500">{user.role}</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                {user.name?.[0]?.toUpperCase() ?? 'U'}
              </span>
              <LogoutButton />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="secondary-button px-4 py-2">
                Log in
              </Link>
              <Link href="/register" className="primary-button px-4 py-2">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
