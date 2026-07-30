'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { Lesson } from '@/types';

interface CurriculumAccordionProps {
  courseId: string;
  lessons: Lesson[];
}

// Udemy-style collapsible curriculum. Since the current data model is a flat
// list of lessons (no sections), we present it as a single expandable
// "Course content" section. If the backend later adds sections, group here.
export default function CurriculumAccordion({ courseId, lessons }: CurriculumAccordionProps) {
  const [open, setOpen] = useState(true);

  const totalMinutes = lessons.reduce((sum, lesson) => sum + (lesson.durationMinutes ?? 0), 0);

  if (lessons.length === 0) {
    return <p className="text-sm text-ink-500">No lessons published yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ink-300/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 bg-muted px-5 py-4 text-left hover:bg-ink-300/20"
      >
        <span className="font-bold text-ink-900">Course content</span>
        <span className="flex items-center gap-3 text-sm text-ink-500">
          <span>
            {lessons.length} lectures{totalMinutes > 0 ? ` • ${totalMinutes} min` : ''}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open ? (
        <ul className="divide-y divide-ink-300/60 bg-white">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/courses/${courseId}/lessons/${lesson.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted"
              >
                <span className="flex items-center gap-3">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="shrink-0 text-ink-500">
                    <path d="M6 4v12l10-6z" />
                  </svg>
                  <span className="text-sm text-ink-800">
                    {lesson.title}
                    {lesson.completed ? <span className="ml-2 text-xs font-semibold text-emerald-600">Completed</span> : null}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-ink-500">
                  {lesson.durationMinutes ? `${lesson.durationMinutes} min` : `Lesson ${lesson.order}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
