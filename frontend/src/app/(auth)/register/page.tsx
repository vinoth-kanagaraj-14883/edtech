'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { registerUser } from '@/lib/api';
import type { User } from '@/types';

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
    <div className="surface overflow-hidden">
      <div className="border-b border-slate-800 px-8 py-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-100">Join the platform</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Create your EdTech account</h1>
        <p className="mt-3 text-sm text-slate-400">Build your learning path across courses, content, and assessments.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 px-8 py-8">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-slate-200">Full name</label>
          <input id="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-200">Email address</label>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-200">Password</label>
          <input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} minLength={8} required />
        </div>

        <div className="space-y-2">
          <label htmlFor="role" className="text-sm font-medium text-slate-200">Role</label>
          <select id="role" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as User['role'] }))}>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
          </select>
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

        <button type="submit" className="primary-button w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Register'}
        </button>

        <p className="text-center text-sm text-slate-400">
          Already have an account? <Link href="/login" className="font-medium text-brand-100 hover:text-white">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
