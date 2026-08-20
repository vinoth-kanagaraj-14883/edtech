import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import Footer from '@/components/Footer';
import Navigation from '@/components/Navigation';
import TelemetryProvider from '@/components/TelemetryProvider';

import './globals.css';

// NOTE: deliberately NOT using next/font/google — it fetches the font at build
// time, which breaks offline and air-gapped Docker builds. `--font-sans` is
// defined in globals.css as a modern system stack instead.

export const metadata: Metadata = {
  title: {
    default: 'EduForge — Learn without limits',
    template: '%s | EduForge'
  },
  description:
    'A modern learning platform for courses, lessons, quizzes, certificates, and personalized progress tracking.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png'
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' }
  ]
};

// Applies the stored theme before first paint so there is no flash on load.
// The design is DARK-FIRST: with no stored preference we default to dark rather
// than following the OS, so first-time visitors get the intended look. Light
// mode is an explicit opt-in via the theme toggle. Kept tiny and dependency-free.
const themeScript = `(function(){try{var s=localStorage.getItem('eduforge-theme');if(s!=='light')document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <TelemetryProvider />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <div className="flex min-h-screen flex-col bg-canvas">
          <Navigation />
          <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
