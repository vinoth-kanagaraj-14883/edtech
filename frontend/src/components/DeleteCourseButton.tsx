'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={handleDelete} disabled={loading} className="text-xs font-medium text-rose-600 hover:text-rose-700">
        {loading ? 'Deleting…' : 'Delete'}
      </button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
