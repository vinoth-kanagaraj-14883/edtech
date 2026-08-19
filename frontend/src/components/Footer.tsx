import Image from 'next/image';
import Link from 'next/link';

const FOOTER_COLUMNS = [
  {
    heading: 'Learn',
    links: [
      { href: '/courses', label: 'All courses' },
      { href: '/quizzes', label: 'Practice quizzes' },
      { href: { pathname: '/courses', query: { search: 'Cloud Computing' } }, label: 'Cloud computing' },
      { href: { pathname: '/courses', query: { search: 'Data & AI' } }, label: 'Data & AI' }
    ]
  },
  {
    heading: 'Community',
    links: [
      { href: '/register', label: 'Become a learner' },
      { href: '/login', label: 'Log in' },
      { href: '/quizzes/create', label: 'Teach on EduForge' },
      { href: '/dashboard', label: 'Your dashboard' }
    ]
  },
  {
    heading: 'Company',
    links: [
      { href: '/', label: 'About' },
      { href: '/', label: 'Careers' },
      { href: '/', label: 'Blog' },
      { href: '/', label: 'Contact' }
    ]
  }
];

export default function Footer() {
  return (
    <footer className="relative mt-20 overflow-hidden border-t border-hairline bg-muted">
      {/* Decorative wash — purely visual. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-px bg-gradient-to-r from-transparent via-brand-400/50 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-content">
              <Image src="/logo.png" alt="" width={56} height={56} className="h-9 w-9 rounded-xl object-contain" />
              <span>
                Edu<span className="gradient-text">Forge</span>
              </span>
            </Link>
            <p className="text-sm font-semibold text-content-muted">Learn. Build. Evolve.</p>
            <p className="max-w-xs text-sm leading-relaxed text-content-subtle">
              Expert-led courses and hundreds of practice quizzes to move your career forward.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-content">{column.heading}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-content-subtle transition hover:text-brand-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-hairline pt-6 sm:flex-row">
          <p className="text-xs text-content-subtle">
            &copy; {new Date().getFullYear()} EduForge. All rights reserved.
          </p>
          <nav className="flex flex-wrap gap-5" aria-label="Legal">
            {['Terms', 'Privacy', 'Cookie settings'].map((label) => (
              <Link key={label} href="/" className="text-xs text-content-subtle transition hover:text-brand-600">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
