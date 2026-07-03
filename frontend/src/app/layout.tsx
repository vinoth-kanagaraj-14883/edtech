import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import Navigation from '@/components/Navigation';
import TelemetryProvider from '@/components/TelemetryProvider';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Polyglot EdTech',
    template: '%s | Polyglot EdTech'
  },
  description: 'A modern learning platform for courses, lessons, quizzes, and personalized progress tracking.'
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <TelemetryProvider />
        <div className="min-h-screen">
          <Navigation />
          <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
