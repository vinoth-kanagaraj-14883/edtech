'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ErrorAlert, Spinner } from '@/components/Feedback';
import { markLessonComplete } from '@/lib/api';

interface LessonCompletionButtonProps {
  courseId: string;
  lessonId: string;
  completed?: boolean;
  /** Lesson count for the course, so course-service can recompute progress %. */
  totalLessons?: number;
}

export default function LessonCompletionButton({ courseId, lessonId, completed, totalLessons }: LessonCompletionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleComplete = async () => {
    try {
      setLoading(true);
      setError(null);
      await markLessonComplete(courseId, lessonId, {}, totalLessons);
      router.refresh();
    } catch (completionError) {
      setError(completionError instanceof Error ? completionError.message : 'Unable to mark the lesson complete.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleComplete}
        className={`w-full ${completed ? 'secondary-button' : 'primary-button'}`}
        disabled={loading || completed}
      >
        {completed ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success-600" aria-hidden="true">
              <path d="m20 6-11 11-5-5" />
            </svg>
            Completed
          </>
        ) : loading ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : (
          'Mark complete'
        )}
      </button>
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
    </div>
  );
}
