'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { enrollInCourse, unenrollFromCourse } from '@/lib/api';

interface EnrollButtonProps {
  courseId: string;
  enrolled?: boolean;
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
      <div className="flex items-center gap-3">
        <span className="secondary-button">Enrolled</span>
        <button type="button" onClick={handleUnenroll} disabled={loading} className="text-xs font-medium text-rose-600 hover:text-rose-700">
          {loading ? 'Removing…' : 'Unenroll'}
        </button>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={handleEnroll} className="primary-button w-full" disabled={loading}>
        {loading ? 'Enrolling…' : 'Enroll now'}
      </button>
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
