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
    return (
      <div className="surface px-6 py-10 text-center">
        <p className="text-sm text-content-subtle">No lessons published yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="curriculum-panel"
        className="flex w-full items-center justify-between gap-4 bg-muted px-5 py-4 text-left transition hover:bg-hairline/40"
      >
        <span className="font-bold text-content">Course content</span>
        <span className="flex items-center gap-3 text-sm text-content-subtle">
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
            aria-hidden="true"
            className={`transition-transform duration-300 ease-smooth ${open ? 'rotate-180' : ''}`}
          >
            <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open ? (
        <ul id="curriculum-panel" className="divide-y divide-hairline">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/courses/${courseId}/lessons/${lesson.id}`}
                className="group flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-muted"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
                      lesson.completed
                        ? 'bg-success-50 text-success-600 dark:bg-success-500/10'
                        : 'bg-muted text-content-subtle ring-1 ring-inset ring-hairline group-hover:text-brand-600'
                    }`}
                  >
                    {lesson.completed ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m20 6-11 11-5-5" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M6 4v12l10-6z" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 text-sm text-content-muted transition group-hover:text-content">
                    <span className="truncate">{lesson.title}</span>
                    {lesson.completed ? (
                      <span className="ml-2 text-xs font-semibold text-success-600">Completed</span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-content-subtle">
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
