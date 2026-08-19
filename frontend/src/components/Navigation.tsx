import Image from 'next/image';
import Link from 'next/link';

import LogoutButton from '@/components/LogoutButton';
import MobileNav from '@/components/MobileNav';
import NavLink from '@/components/NavLink';
import ThemeToggle from '@/components/ThemeToggle';
import { getServerUser } from '@/lib/server-auth';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/courses', label: 'Courses' },
  { href: '/quizzes', label: 'Quizzes' },
  { href: '/profile', label: 'Profile' }
];

function SearchBar() {
  return (
    <form action="/courses" className="hidden flex-1 items-center lg:flex" role="search">
      <div className="relative w-full max-w-xl">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="9" cy="9" r="6" />
            <path d="m14 14 4 4" strokeLinecap="round" />
          </svg>
        </span>
        <label htmlFor="nav-search" className="sr-only">
          Search courses
        </label>
        <input
          id="nav-search"
          type="search"
          name="search"
          placeholder="Search courses, topics, instructors…"
          className="rounded-full bg-muted py-2 pl-10 pr-4 text-sm"
        />
      </div>
    </form>
  );
}

export default function Navigation() {
  const user = getServerUser();
  const navLinks = user?.role === 'instructor' ? [...links, { href: '/quizzes/create', label: 'Create quiz' }] : links;
  const visibleLinks = user ? navLinks : [];

  return (
    <header className="glass sticky top-0 z-50 border-b border-hairline">
      <nav className="relative mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight text-content"
        >
          <Image
            src="/logo.png"
            alt=""
            width={72}
            height={72}
            className="h-9 w-9 rounded-xl object-contain"
            priority
          />
          <span className="hidden sm:inline">
            Edu<span className="gradient-text">Forge</span>
          </span>
        </Link>

        <Link
          href="/courses"
          className="hidden shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-content-muted transition hover:text-brand-600 xl:inline"
        >
          Explore
        </Link>

        <SearchBar />

        {user ? (
          <div className="hidden shrink-0 items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {link.label}
              </NavLink>
            ))}
          </div>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ThemeToggle />

          {user ? (
            <>
              <div className="hidden text-right lg:block">
                <p className="text-sm font-semibold leading-tight text-content">{user.name}</p>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-content-subtle">{user.role}</p>
              </div>
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white shadow-glow"
              >
                {user.name?.[0]?.toUpperCase() ?? 'U'}
              </span>
              <div className="hidden sm:block">
                <LogoutButton />
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="secondary-button px-4 py-2">
                Log in
              </Link>
              <Link href="/register" className="primary-button px-4 py-2">
                Sign up
              </Link>
            </div>
          )}

          <MobileNav links={visibleLinks} isAuthenticated={Boolean(user)} />
        </div>
      </nav>
    </header>
  );
}
