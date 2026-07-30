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
    <footer className="mt-16 border-t border-ink-300/70 bg-muted">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-extrabold text-ink-900">
              <Image src="/logo.png" alt="EduForge" width={40} height={40} className="h-10 w-10 object-contain" />
              <span>
                Edu<span className="text-brand-500">Forge</span>
              </span>
            </Link>
            <p className="text-sm text-ink-500">Learn. Build. Evolve.</p>
            <p className="max-w-xs text-sm text-ink-500">
              Expert-led courses and hundreds of practice quizzes to move your career forward.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="text-sm font-bold text-ink-900">{column.heading}</h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-ink-500 hover:text-brand-600">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-ink-300/70 pt-6 sm:flex-row">
          <p className="text-xs text-ink-500">&copy; {new Date().getFullYear()} EduForge. All rights reserved.</p>
          <nav className="flex flex-wrap gap-5">
            <Link href="/" className="text-xs text-ink-500 hover:text-brand-600">
              Terms
            </Link>
            <Link href="/" className="text-xs text-ink-500 hover:text-brand-600">
              Privacy
            </Link>
            <Link href="/" className="text-xs text-ink-500 hover:text-brand-600">
              Cookie settings
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
