import Image from 'next/image';
import Link from 'next/link';

import DeleteCourseButton from '@/components/DeleteCourseButton';
import ProgressBar from '@/components/ProgressBar';
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

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card transition duration-300 ease-smooth hover:-translate-y-1 hover:border-brand-300/70 hover:shadow-card-hover">
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
            className="object-cover transition duration-500 ease-smooth group-hover:scale-[1.04]"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} p-5`}>
            <span className="line-clamp-3 text-center text-lg font-extrabold leading-tight text-white drop-shadow-sm">
              {course.title}
            </span>
          </div>
        )}

        {/* Top-right status pills */}
        <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1.5">
          {enrolled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-500/95 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm backdrop-blur">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                <path d="m20 6-11 11-5-5" />
              </svg>
              Enrolled
            </span>
          ) : null}
          {bestseller ? (
            <span className="inline-flex items-center rounded-full bg-warning-500/95 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur">
              Bestseller
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-[15px] font-bold leading-snug tracking-tight">
          <Link
            href={`/courses/${course.id}`}
            className="line-clamp-2-safe text-content transition group-hover:text-brand-600"
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
          <span className="chip">{course.lessons.length} lessons</span>
        </div>

        {typeof course.progress === 'number' && course.progress > 0 ? (
          <div className="pt-1.5">
            <ProgressBar value={course.progress} label="Course progress" />
          </div>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <span className="text-xl font-extrabold tracking-tight text-content">{formatPrice(course.price)}</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 opacity-0 transition duration-300 group-hover:opacity-100">
            View
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </div>

        {isOwner || (showUnenroll && enrolled) ? (
          <div className="mt-2 flex items-center justify-end gap-3 border-t border-hairline pt-3">
            {isOwner ? (
              <>
                <Link
                  href={`/courses/${course.id}/edit`}
                  className="text-xs font-semibold text-forge-600 transition hover:text-forge-700"
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
