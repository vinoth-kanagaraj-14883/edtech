'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { enrollInCourse, unenrollFromCourse } from '@/lib/api';

interface EnrollButtonProps {
  courseId: string;
  enrolled?: boolean;
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-danger-500/25 bg-danger-50 px-3 py-2 text-sm font-medium text-danger-600 animate-fade-in dark:bg-danger-500/10"
    >
      <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="1.1" fill="currentColor" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

function SuccessAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-success-500/25 bg-success-50 px-3 py-2 text-sm font-medium text-success-600 animate-fade-in dark:bg-success-500/10"
    >
      <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="m8.5 12.2 2.4 2.4 4.6-4.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export default function EnrollButton({ courseId, enrolled }: EnrollButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleEnroll = async () => {
    try {
      setLoading(true);
      setError(null);
      await enrollInCourse(courseId);
      setMessage('You are now enrolled in this course.');
      router.refresh();
    } catch (enrollmentError) {
      setError(enrollmentError instanceof Error ? enrollmentError.message : 'Unable to enroll right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async () => {
    if (!window.confirm('Remove this course from your enrolled list? Your progress will be lost.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await unenrollFromCourse(courseId);
      setMessage(null);
      router.refresh();
    } catch (unenrollError) {
      setError(unenrollError instanceof Error ? unenrollError.message : 'Unable to unenroll right now.');
    } finally {
      setLoading(false);
    }
  };

  if (enrolled) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip-brand">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Enrolled
          </span>
          <button type="button" onClick={handleUnenroll} disabled={loading} className="danger-button text-xs">
            {loading ? (
              <>
                <Spinner />
                Removing…
              </>
            ) : (
              'Unenroll'
            )}
          </button>
        </div>
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={handleEnroll} className="primary-button w-full" disabled={loading}>
        {loading ? (
          <>
            <Spinner />
            Enrolling…
          </>
        ) : (
          'Enroll now'
        )}
      </button>
      {message ? <SuccessAlert>{message}</SuccessAlert> : null}
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
    </div>
  );
}
