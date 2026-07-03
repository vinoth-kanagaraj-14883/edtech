'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { markLessonComplete } from '@/lib/api';

interface LessonCompletionButtonProps {
  courseId: string;
  lessonId: string;
  completed?: boolean;
}

export default function LessonCompletionButton({ courseId, lessonId, completed }: LessonCompletionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleComplete = async () => {
    try {
      setLoading(true);
      setError(null);
      await markLessonComplete(courseId, lessonId);
      router.refresh();
    } catch (completionError) {
      setError(completionError instanceof Error ? completionError.message : 'Unable to mark the lesson complete.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={handleComplete} className={completed ? 'secondary-button' : 'primary-button'} disabled={loading || completed}>
        {completed ? 'Completed' : loading ? 'Saving…' : 'Mark complete'}
      </button>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
