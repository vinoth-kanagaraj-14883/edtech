'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { unenrollFromCourse } from '@/lib/api';

interface UnenrollButtonProps {
  courseId: string;
  className?: string;
}

export default function UnenrollButton({ courseId, className }: UnenrollButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnenroll = async () => {
    if (!window.confirm('Remove this course from your enrolled list? Your progress will be lost.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await unenrollFromCourse(courseId);
      router.refresh();
    } catch (unenrollError) {
      setError(unenrollError instanceof Error ? unenrollError.message : 'Unable to remove this course.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleUnenroll}
        disabled={loading}
        className={className ?? 'text-xs font-medium text-rose-600 hover:text-rose-700'}
      >
        {loading ? 'Removing…' : 'Unenroll'}
      </button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
