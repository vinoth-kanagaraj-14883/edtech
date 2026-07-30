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

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-ink-300/60 bg-white shadow-card transition hover:shadow-card-hover">
      <Link href={`/courses/${course.id}`} className="relative block aspect-video w-full overflow-hidden">
        {course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt={course.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} p-4`}>
            <span className="line-clamp-3 text-center text-lg font-extrabold leading-tight text-white drop-shadow">
              {course.title}
            </span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <Link href={`/courses/${course.id}`} className="line-clamp-2 text-base font-bold leading-snug text-ink-900 hover:text-brand-600">
          {course.title}
        </Link>

        {course.instructor ? <p className="text-xs text-ink-500">{course.instructor}</p> : null}

        <StarRating value={rating} count={ratingCount} />

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
          <span className="capitalize">{course.level.replace('-', ' ')}</span>
          {course.durationHours ? <span>• {course.durationHours} total hours</span> : null}
          <span>• {course.lessons.length} lessons</span>
        </div>

        {typeof course.progress === 'number' && course.progress > 0 ? (
          <div className="pt-1">
            <ProgressBar value={course.progress} label="Course progress" />
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-lg font-extrabold text-ink-900">{formatPrice(course.price)}</span>
          {bestseller ? <span className="badge-bestseller">Bestseller</span> : null}
        </div>

        {(isOwner || (showUnenroll && course.enrolled)) ? (
          <div className="mt-2 flex items-center justify-end gap-3 border-t border-ink-300/50 pt-3">
            {isOwner ? (
              <>
                <Link href={`/courses/${course.id}/edit`} className="text-xs font-semibold text-forge-500 hover:text-forge-700">
                  Edit
                </Link>
                <DeleteCourseButton courseId={course.id} />
              </>
            ) : null}
            {showUnenroll && course.enrolled ? <UnenrollButton courseId={course.id} /> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
