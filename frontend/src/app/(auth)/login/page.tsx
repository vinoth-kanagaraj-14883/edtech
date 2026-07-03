'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="surface overflow-hidden">
      <div className="border-b border-slate-800 px-8 py-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-100">Welcome back</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Sign in to continue learning</h1>
        <p className="mt-3 text-sm text-slate-400">Access your courses, quizzes, and progress from a single dashboard.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 px-8 py-8">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-200">Email address</label>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-200">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <button type="submit" className="primary-button w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Login'}
        </button>

        <p className="text-center text-sm text-slate-400">
          New to the platform? <Link href="/register" className="font-medium text-brand-100 hover:text-white">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
