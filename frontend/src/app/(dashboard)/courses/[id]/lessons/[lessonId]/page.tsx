import Link from 'next/link';

import LessonCompletionButton from '@/components/LessonCompletionButton';
import { getCourse, getLesson } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';

interface LessonPageProps {
  params: {
    id: string;
    lessonId: string;
  };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { token } = requireServerAuth();

  try {
    const [course, lesson] = await Promise.all([
      getCourse(params.id, { token }),
      getLesson(params.id, params.lessonId, { token })
    ]);
    const currentIndex = course.lessons.findIndex((item) => item.id === lesson.id);
    const nextLesson = currentIndex >= 0 ? course.lessons[currentIndex + 1] : undefined;
    const previousLesson = currentIndex > 0 ? course.lessons[currentIndex - 1] : undefined;
    const position = currentIndex >= 0 ? currentIndex + 1 : 1;

    return (
      <div className="space-y-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-content-subtle">
          <Link href={`/courses/${course.id}`} className="transition hover:text-brand-600">
            {course.title}
          </Link>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
          <span className="font-medium text-content">{lesson.title}</span>
        </nav>

        {/* Player placeholder */}
        <section className="relative isolate overflow-hidden rounded-2xl border border-hairline">
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink-950" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-mesh opacity-80" />
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 px-6 py-14 text-center sm:min-h-[340px]">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/25 backdrop-blur">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5-11-6.5Z" />
              </svg>
            </span>
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                Lesson {position} of {course.lessons.length}
              </p>
              <h1 className="text-headline text-white">{lesson.title}</h1>
              <p className="text-sm text-white/60">Video player placeholder</p>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Reading column — constrained for comfortable line length. */}
          <article className="max-w-3xl space-y-8">
            <section className="surface p-6 sm:p-8" aria-labelledby="lesson-content-heading">
              <h2 id="lesson-content-heading" className="section-title">
                Lesson content
              </h2>
              <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-content-muted">
                {lesson.content?.body ??
                  lesson.summary ??
                  'Lesson content will appear here once published by the instructor.'}
              </p>
            </section>

            {lesson.content?.resources && lesson.content.resources.length > 0 ? (
              <section className="surface p-6 sm:p-8" aria-labelledby="resources-heading">
                <h2 id="resources-heading" className="section-title">
                  Resources
                </h2>
                <ul className="mt-4 space-y-2">
                  {lesson.content.resources.map((resource) => (
                    <li key={resource.url}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-brand-600 transition hover:text-brand-700"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M14 3h7v7M10 14 21 3M18 13v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h7" />
                        </svg>
                        {resource.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Prev / next navigation */}
            <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Lesson navigation">
              {previousLesson ? (
                <Link href={`/courses/${course.id}/lessons/${previousLesson.id}`} className="secondary-button">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 12H5M11 18l-6-6 6-6" />
                  </svg>
                  Previous
                </Link>
              ) : (
                <span />
              )}
              {nextLesson ? (
                <Link href={`/courses/${course.id}/lessons/${nextLesson.id}`} className="primary-button">
                  Next lesson
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              ) : null}
            </nav>
          </article>

          <aside className="space-y-5">
            <div className="surface p-6 lg:sticky lg:top-24">
              <h2 className="text-lg font-bold tracking-tight text-content">Progress checkpoint</h2>
              <p className="mt-2 text-sm leading-relaxed text-content-muted">
                Mark this lesson complete to update your dashboard and continue your learning path.
              </p>
              <div className="mt-5">
                <LessonCompletionButton courseId={course.id} lessonId={lesson.id} completed={lesson.completed} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2.5 rounded-xl border border-danger-500/25 bg-danger-50 px-4 py-3.5 text-sm text-danger-600 dark:bg-danger-500/10"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-px shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4.5M12 16h.01" />
        </svg>
        <span>{error instanceof Error ? error.message : 'Unable to load this lesson.'}</span>
      </div>
    );
  }
}
