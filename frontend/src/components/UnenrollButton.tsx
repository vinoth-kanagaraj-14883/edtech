'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ErrorAlert, Spinner } from '@/components/Feedback';
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
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleUnenroll}
        disabled={loading}
        className={className ?? 'danger-button px-3 py-1.5 text-xs'}
      >
        {loading ? (
          <>
            <Spinner className="h-3.5 w-3.5" />
            Removing…
          </>
        ) : (
          'Unenroll'
        )}
      </button>
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
    </div>
  );
}
