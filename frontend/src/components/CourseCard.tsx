import Image from 'next/image';
import Link from 'next/link';

import DeleteCourseButton from '@/components/DeleteCourseButton';
import StarRating from '@/components/StarRating';
import UnenrollButton from '@/components/UnenrollButton';
import { coverGradient, derivedRating, derivedRatingCount, formatPrice, isBestseller } from '@/lib/course-meta';
import type { Course } from '@/types';

interface CourseCardProps {
  course: Course;
  currentUserId?: string;
  currentUserRole?: string;
  showUnenroll?: boolean;
}

export default function CourseCard({ course, currentUserId, currentUserRole, showUnenroll }: CourseCardProps) {
  const isOwner = currentUserRole === 'instructor' && currentUserId && course.instructorId === currentUserId;
  const gradient = coverGradient(course.id);
  const rating = derivedRating(course);
  const ratingCount = derivedRatingCount(course);
  const bestseller = isBestseller(course);
  const enrolled = Boolean(course.enrolled);
  const progress = Math.max(0, Math.min(100, Math.round(course.progress ?? course.enrollment?.progress ?? 0)));
  const isComplete = progress >= 100;
  const completedLessons = course.enrollment?.completedLessons ?? 0;
  const totalLessons = course.lessons?.length || course.enrollment?.totalLessons || 0;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card transition duration-300 ease-smooth hover:-translate-y-1 hover:border-brand-400/60 hover:shadow-card-hover">
      {/* Accent bloom that reveals on hover — the dark theme's signature. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${gradient} opacity-0 blur-3xl transition duration-500 group-hover:opacity-30`}
      />

      <Link
        href={`/courses/${course.id}`}
        className="relative block aspect-video w-full overflow-hidden bg-muted"
        tabIndex={-1}
        aria-hidden="true"
      >
        {course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-500 ease-smooth group-hover:scale-[1.05]"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} p-5`}>
            <span className="line-clamp-3 text-center text-lg font-extrabold leading-tight text-white drop-shadow">
              {course.title}
            </span>
          </div>
        )}

        {/* Scrim keeps the overlaid pills and progress bar legible on any cover. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-ink-950/75 via-ink-950/10 to-transparent"
        />

        {/* Status pills */}
        <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1.5">
          {isComplete ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                <path d="m20 6-11 11-5-5" />
              </svg>
              Complete
            </span>
          ) : enrolled ? (
            <span className="inline-flex items-center rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-glow">
              Enrolled
            </span>
          ) : null}
          {bestseller ? (
            <span className="inline-flex items-center rounded-full bg-warning-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-950 shadow-sm">
              Bestseller
            </span>
          ) : null}
        </div>

        {/* Netflix-style progress strip pinned to the bottom of the cover. */}
        {enrolled && progress > 0 ? (
          <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                <div
                  className={`h-full rounded-full ${isComplete ? 'bg-success-400' : 'bg-brand-gradient'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[11px] font-bold tabular-nums text-white drop-shadow">{progress}%</span>
            </div>
          </div>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-base font-bold leading-snug tracking-tight">
          <Link
            href={`/courses/${course.id}`}
            className="line-clamp-2-safe text-content transition group-hover:text-brand-300"
          >
            {course.title}
          </Link>
        </h3>

        {course.instructor ? (
          <p className="text-xs font-medium text-content-subtle">{course.instructor}</p>
        ) : null}

        <StarRating value={rating} count={ratingCount} />

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="chip capitalize">{course.level.replace('-', ' ')}</span>
          {course.durationHours ? <span className="chip">{course.durationHours}h</span> : null}
          {totalLessons > 0 ? <span className="chip">{totalLessons} lessons</span> : null}
        </div>

        {enrolled && totalLessons > 0 ? (
          <p className="pt-0.5 text-xs font-semibold text-content-muted">
            {isComplete ? (
              <span className="text-success-400">All {totalLessons} lessons complete 🎉</span>
            ) : (
              <>
                {completedLessons} of {totalLessons} lessons done
              </>
            )}
          </p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          {enrolled ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-300">
              {isComplete ? 'Review' : progress > 0 ? 'Resume' : 'Start'}
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          ) : (
            <>
              <span className="text-xl font-extrabold tracking-tight text-content">{formatPrice(course.price)}</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-300 opacity-0 transition duration-300 group-hover:opacity-100">
                View
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </>
          )}
        </div>

        {isOwner || (showUnenroll && enrolled) ? (
          <div className="mt-2 flex items-center justify-end gap-3 border-t border-hairline pt-3">
            {isOwner ? (
              <>
                <Link
                  href={`/courses/${course.id}/edit`}
                  className="text-xs font-semibold text-forge-400 transition hover:text-forge-500"
                >
                  Edit
                </Link>
                <DeleteCourseButton courseId={course.id} />
              </>
            ) : null}
            {showUnenroll && enrolled ? <UnenrollButton courseId={course.id} /> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
