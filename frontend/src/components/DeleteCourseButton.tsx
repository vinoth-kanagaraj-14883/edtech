'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ErrorAlert, Spinner } from '@/components/Feedback';
import { deleteCourse } from '@/lib/api';

interface DeleteCourseButtonProps {
  courseId: string;
  redirectTo?: string;
}

export default function DeleteCourseButton({ courseId, redirectTo }: DeleteCourseButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!window.confirm('Delete this course? This cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await deleteCourse(courseId);
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this course.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" onClick={handleDelete} disabled={loading} className="danger-button px-3 py-1.5 text-xs">
        {loading ? (
          <>
            <Spinner className="h-3.5 w-3.5" />
            Deleting…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
            </svg>
            Delete
          </>
        )}
      </button>
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
    </div>
  );
}
