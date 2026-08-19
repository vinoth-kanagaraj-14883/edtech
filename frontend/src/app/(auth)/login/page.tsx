'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import PasswordField from '@/components/PasswordField';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(form)
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Invalid email or password.');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface p-8 sm:p-9">
      <header className="space-y-2">
        <p className="eyebrow">Welcome back</p>
        <h1 className="text-headline text-content">Sign in to continue learning</h1>
        <p className="section-subtitle">
          Access your courses, quizzes and progress from a single dashboard.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-semibold text-content">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            required
            aria-invalid={error ? true : undefined}
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={form.password}
          onChange={(value) => setForm((current) => ({ ...current, password: value }))}
          autoComplete="current-password"
        />

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger-500/25 bg-danger-50 px-3.5 py-3 text-sm text-danger-600 dark:bg-danger-500/10"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-px shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4.5M12 16h.01" />
            </svg>
            <span>{error}</span>
          </div>
        ) : null}

        <button type="submit" className="primary-button w-full py-3" disabled={loading}>
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>

        <p className="text-center text-sm text-content-subtle">
          New to the platform?{' '}
          <Link href="/register" className="font-semibold text-brand-600 transition hover:text-brand-700">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
