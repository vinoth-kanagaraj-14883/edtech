import Link from 'next/link';

import ProgressRing from '@/components/ProgressRing';
import { coverGradient } from '@/lib/course-meta';
import type { ContinueTarget } from '@/lib/gamification';

interface ContinueLearningHeroProps {
  target: ContinueTarget;
  /** First name, used for the greeting line. */
  firstName: string;
}

function greeting(hour: number): string {
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 18) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

/**
 * The dashboard's focal card: one obvious next action.
 *
 * This replaces the old "four identical KPI tiles" opening, which reported at
 * the learner instead of pulling them into the next lesson.
 */
export default function ContinueLearningHero({ target, firstName }: ContinueLearningHeroProps) {
  const { course, nextLesson, lessonNumber, totalLessons, progress } = target;
  const gradient = coverGradient(course.id);
  const resumeHref = nextLesson
    ? `/courses/${course.id}/lessons/${nextLesson.id}`
    : `/courses/${course.id}`;
  const isFinished = progress >= 100;

  return (
    <section className="aurora-panel px-6 py-8 sm:px-10 sm:py-10" aria-labelledby="continue-heading">
      {/* Cover-tinted bloom so each course feels visually distinct. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-16 -top-20 -z-10 h-64 w-64 rounded-full bg-gradient-to-br ${gradient} opacity-25 blur-3xl`}
      />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-5">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-content-subtle">
              {greeting(new Date().getHours())}, {firstName}
            </p>
            <p className="eyebrow">
              <span className="flex h-1.5 w-1.5 animate-glow-pulse rounded-full bg-brand-400" aria-hidden="true" />
              {isFinished ? 'Course complete' : 'Continue learning'}
            </p>
          </div>

          <div className="space-y-2">
            <h1 id="continue-heading" className="text-headline text-content">
              {course.title}
            </h1>
            {nextLesson ? (
              <p className="max-w-xl text-base leading-relaxed text-content-muted">
                <span className="font-semibold text-content">Up next:</span> {nextLesson.title}
              </p>
            ) : (
              <p className="max-w-xl text-base leading-relaxed text-content-muted">
                {isFinished
                  ? 'You have finished every lesson in this course. Time to claim your certificate.'
                  : 'Jump back into the course overview to choose your next lesson.'}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {totalLessons > 0 ? (
              <span className="chip-brand">
                Lesson {Math.min(lessonNumber, totalLessons)} of {totalLessons}
              </span>
            ) : null}
            {nextLesson?.durationMinutes ? (
              <span className="chip">{nextLesson.durationMinutes} min</span>
            ) : null}
            <span className="chip capitalize">{course.level.replace('-', ' ')}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href={resumeHref} className="cta-button">
              {isFinished ? 'Review course' : progress > 0 ? 'Resume lesson' : 'Start first lesson'}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link href={`/courses/${course.id}`} className="secondary-button">
              Course overview
            </Link>
          </div>
        </div>

        {/* Progress ring — the visual reward for showing up. */}
        <div className="flex shrink-0 items-center gap-6 lg:flex-col lg:items-end lg:gap-3">
          <ProgressRing
            value={progress}
            size={156}
            strokeWidth={12}
            caption="complete"
            variant={isFinished ? 'success' : 'brand'}
            className="animate-scale-in"
          />
        </div>
      </div>
    </section>
  );
}
