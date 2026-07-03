'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { enrollInCourse } from '@/lib/api';

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

  if (enrolled) {
    return <span className="secondary-button">Enrolled</span>;
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={handleEnroll} className="primary-button" disabled={loading}>
        {loading ? 'Enrolling…' : 'Enroll now'}
      </button>
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
