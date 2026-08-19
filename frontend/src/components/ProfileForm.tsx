'use client';

import { FormEvent, useState } from 'react';

import { ErrorAlert, Spinner, SuccessAlert } from '@/components/Feedback';
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
    <form onSubmit={handleSubmit} className="surface space-y-6 p-6 sm:p-8">
      {/* Identity header */}
      <div className="flex items-center gap-4 border-b border-hairline pb-6">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-xl font-bold text-white shadow-glow"
          aria-hidden="true"
        >
          {user.name?.[0]?.toUpperCase() ?? 'U'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-content">{user.name}</p>
          <p className="truncate text-sm text-content-subtle">{user.email}</p>
        </div>
        <span className="chip-brand ml-auto capitalize">{user.role}</span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-semibold text-content">
            Full name
          </label>
          <input
            id="name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-semibold text-content">
            Email address
          </label>
          <input id="email" value={user.email} disabled className="cursor-not-allowed opacity-60" />
          <p className="text-xs text-content-subtle">Email cannot be changed here.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="headline" className="block text-sm font-semibold text-content">
          Headline
        </label>
        <input
          id="headline"
          value={form.headline}
          onChange={(event) => setForm((current) => ({ ...current, headline: event.target.value }))}
          placeholder="Senior learner, polyglot instructor, product builder…"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="bio" className="block text-sm font-semibold text-content">
          Bio
        </label>
        <textarea
          id="bio"
          rows={5}
          value={form.bio}
          onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
          placeholder="Tell fellow learners about your goals and interests."
        />
      </div>

      {message ? <SuccessAlert>{message}</SuccessAlert> : null}
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}

      <div className="flex flex-wrap items-center gap-4 border-t border-hairline pt-6">
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </form>
  );
}
