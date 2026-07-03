'use client';

import { FormEvent, useState } from 'react';

import { updateProfile } from '@/lib/api';
import type { User } from '@/types';

interface ProfileFormProps {
  user: User;
}

export default function ProfileForm({ user }: ProfileFormProps) {
  const [form, setForm] = useState({
    name: user.name,
    headline: user.headline ?? '',
    bio: user.bio ?? ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      await updateProfile(form);
      setMessage('Profile updated successfully.');
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Unable to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="surface space-y-6 p-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-slate-200">
            Full name
          </label>
          <input id="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-200">
            Email address
          </label>
          <input id="email" value={user.email} disabled className="opacity-70" />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="headline" className="text-sm font-medium text-slate-200">
          Headline
        </label>
        <input id="headline" value={form.headline} onChange={(event) => setForm((current) => ({ ...current, headline: event.target.value }))} placeholder="Senior learner, polyglot instructor, product builder…" />
      </div>

      <div className="space-y-2">
        <label htmlFor="bio" className="text-sm font-medium text-slate-200">
          Bio
        </label>
        <textarea id="bio" rows={5} value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} placeholder="Tell fellow learners about your goals and interests." />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? 'Saving…' : 'Save changes'}
        </button>
        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </form>
  );
}
