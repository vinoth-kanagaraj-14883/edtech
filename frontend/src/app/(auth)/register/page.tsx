'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import PasswordField from '@/components/PasswordField';
import { registerUser } from '@/lib/api';
import type { User } from '@/types';

const ROLES: { value: User['role']; label: string; description: string }[] = [
  { value: 'student', label: 'Student', description: 'Take courses and quizzes' },
  { value: 'instructor', label: 'Instructor', description: 'Create and publish content' }
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student' as User['role']
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      await registerUser(form);
      setMessage('Registration successful. You can log in now.');
      setTimeout(() => router.push('/login'), 800);
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface p-8 sm:p-9">
      <header className="space-y-2">
        <p className="eyebrow">Join the platform</p>
        <h1 className="text-headline text-content">Create your EduForge account</h1>
        <p className="section-subtitle">
          Build your learning path across courses, content and assessments.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-semibold text-content">
            Full name
          </label>
          <input
            id="name"
            placeholder="Ada Lovelace"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </div>

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
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={form.password}
          onChange={(value) => setForm((current) => ({ ...current, password: value }))}
          autoComplete="new-password"
          hint="At least 8 characters."
        />

        {/* Role picker — segmented cards instead of a bare <select>. */}
        <fieldset className="space-y-2">
          <legend className="mb-2 block text-sm font-semibold text-content">I am joining as</legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map((role) => {
              const selected = form.role === role.value;
              return (
                <label
                  key={role.value}
                  className={`cursor-pointer rounded-xl border p-3.5 transition duration-200 ${
                    selected
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/25 dark:bg-brand-500/10'
                      : 'border-hairline bg-surface hover:border-brand-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role.value}
                    checked={selected}
                    onChange={() => setForm((current) => ({ ...current, role: role.value }))}
                    className="sr-only"
                  />
                  <span
                    className={`block text-sm font-bold ${selected ? 'text-brand-700 dark:text-brand-300' : 'text-content'}`}
                  >
                    {role.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-content-subtle">{role.description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

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

        {message ? (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-success-500/25 bg-success-50 px-3.5 py-3 text-sm text-success-600 dark:bg-success-500/10"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0" aria-hidden="true">
              <path d="m20 6-11 11-5-5" />
            </svg>
            <span>{message}</span>
          </div>
        ) : null}

        <button type="submit" className="primary-button w-full py-3" disabled={loading}>
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </button>

        <p className="text-center text-sm text-content-subtle">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-600 transition hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
