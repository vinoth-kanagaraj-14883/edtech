import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import Footer from '@/components/Footer';
import Navigation from '@/components/Navigation';
import TelemetryProvider from '@/components/TelemetryProvider';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'EduForge',
    template: '%s | EduForge'
  },
  description: 'A modern learning platform for courses, lessons, quizzes, and personalized progress tracking.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png'
  }
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <TelemetryProvider />
        <div className="flex min-h-screen flex-col">
          <Navigation />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
