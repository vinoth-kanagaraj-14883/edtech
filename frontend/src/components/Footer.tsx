import Image from 'next/image';
import Link from 'next/link';

const FOOTER_LINKS = [
  { href: '/courses', label: 'Courses' },
  { href: '/quizzes', label: 'Quizzes' },
  { href: '/register', label: 'Create account' },
  { href: '/login', label: 'Login' }
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="EduForge" width={28} height={28} className="h-7 w-7 object-contain" />
          <div>
            <p className="text-sm font-semibold text-white">EduForge</p>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Learn. Build. Evolve.</p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-5">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-slate-400 hover:text-forge-100">
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="text-xs text-slate-600">&copy; {new Date().getFullYear()} EduForge. All rights reserved.</p>
      </div>
    </footer>
  );
}
