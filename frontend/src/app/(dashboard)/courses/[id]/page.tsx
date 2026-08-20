import Image from 'next/image';
import Link from 'next/link';

import CurriculumAccordion from '@/components/CurriculumAccordion';
import DeleteCourseButton from '@/components/DeleteCourseButton';
import EnrollButton from '@/components/EnrollButton';
import ProgressBar from '@/components/ProgressBar';
import StarRating from '@/components/StarRating';
import { getCourse } from '@/lib/api';
import {
  coverGradient,
  derivedRating,
  derivedRatingCount,
  derivedStudentCount,
  formatPrice,
  isBestseller,
  learningOutcomes
} from '@/lib/course-meta';
import { requireServerAuth } from '@/lib/server-auth';

interface CourseDetailPageProps {
  params: {
    id: string;
  };
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { token, user } = requireServerAuth();

  let course;
  try {
    course = await getCourse(params.id, { token });
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
        <span>{error instanceof Error ? error.message : 'Unable to load the selected course.'}</span>
      </div>
    );
  }

  const isOwner = user.role === 'instructor' && course.instructorId === user.id;
  const rating = derivedRating(course);
  const ratingCount = derivedRatingCount(course);
  const studentCount = derivedStudentCount(course);
  const bestseller = isBestseller(course);
  const gradient = coverGradient(course.id);
  const outcomes = learningOutcomes(course);
  const totalMinutes = course.lessons.reduce((sum, lesson) => sum + (lesson.durationMinutes ?? 0), 0);

  return (
    <div className="space-y-10">
      {/* Hero band */}
      <section className="relative -mx-4 isolate overflow-hidden px-4 py-12 text-white sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink-950" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-mesh opacity-80" />

        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="max-w-3xl space-y-5">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-white/60">
              <Link href="/courses" className="transition hover:text-white">
                Courses
              </Link>
              {course.category ? (
                <>
                  <span aria-hidden="true">/</span>
                  <Link
                    href={{ pathname: '/courses', query: { search: course.category } }}
                    className="transition hover:text-white"
                  >
                    {course.category}
                  </Link>
                </>
              ) : null}
            </nav>

            <h1 className="text-display text-white">{course.title}</h1>
            <p className="text-lg leading-relaxed text-white/80">
              {course.shortDescription ?? course.description}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {bestseller ? <span className="badge-bestseller">Bestseller</span> : null}
              <StarRating value={rating} count={ratingCount} size="md" onDark />
              <span className="text-sm text-white/70">{studentCount.toLocaleString()} students</span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70">
              {course.instructor ? (
                <span>
                  Created by <span className="font-semibold text-white">{course.instructor}</span>
                </span>
              ) : null}
              <span className="capitalize">• {course.level.replace('-', ' ')}</span>
              {course.durationHours ? <span>• {course.durationHours} total hours</span> : null}
              <span>• {course.lessons.length} lessons</span>
            </div>
          </div>

          {/* Sticky purchase / enroll card */}
          <aside>
            <div className="overflow-hidden rounded-2xl border border-hairline bg-surface text-content shadow-lifted lg:sticky lg:top-24">
              <div className="relative aspect-video w-full bg-muted">
                {course.thumbnailUrl ? (
                  <Image src={course.thumbnailUrl} alt="" fill sizes="360px" className="object-cover" />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} p-4`}>
                    <span className="line-clamp-3 text-center text-lg font-extrabold leading-tight text-white drop-shadow-sm">
                      {course.title}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4 p-6">
                <p className="text-3xl font-extrabold tracking-tight text-content">{formatPrice(course.price)}</p>

                {isOwner ? (
                  <div className="flex flex-col gap-3">
                    <Link href={`/courses/${course.id}/edit`} className="secondary-button w-full">
                      Edit course
                    </Link>
                    <DeleteCourseButton courseId={course.id} redirectTo="/courses" />
                  </div>
                ) : (
                  <EnrollButton courseId={course.id} enrolled={course.enrolled} />
                )}

                {course.lessons[0] ? (
                  <Link href={`/courses/${course.id}/lessons/${course.lessons[0].id}`} className="link-button w-full">
                    {course.enrolled ? 'Continue learning' : 'Preview first lesson'}
                  </Link>
                ) : null}

                {typeof course.progress === 'number' && course.progress > 0 ? (
                  <ProgressBar value={course.progress} label="Your progress" />
                ) : null}

                <ul className="space-y-2.5 border-t border-hairline pt-4 text-sm text-content-muted">
                  <li className="flex justify-between">
                    <span>Lessons</span>
                    <span className="font-semibold text-content">{course.lessons.length}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Quizzes</span>
                    <span className="font-semibold text-content">{course.quizIds?.length ?? 0}</span>
                  </li>
                  {totalMinutes > 0 ? (
                    <li className="flex justify-between">
                      <span>Total length</span>
                      <span className="font-semibold text-content">{totalMinutes} min</span>
                    </li>
                  ) : null}
                  <li className="flex justify-between">
                    <span>Level</span>
                    <span className="font-semibold capitalize text-content">{course.level.replace('-', ' ')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* What you'll learn */}
      <section className="surface p-6 sm:p-8" aria-labelledby="outcomes-heading">
        <h2 id="outcomes-heading" className="section-title">
          What you&apos;ll learn
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {outcomes.map((outcome) => (
            <li key={outcome} className="flex items-start gap-3 text-sm leading-relaxed text-content-muted">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
                aria-hidden="true"
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="m5 10 3.5 3.5L15 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>{outcome}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Course content / curriculum */}
      <section className="space-y-5" aria-labelledby="curriculum-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="curriculum-heading" className="section-title">
            Course content
          </h2>
          <p className="chip">
            {course.lessons.length} lectures{totalMinutes > 0 ? ` • ${totalMinutes} min total` : ''}
          </p>
        </div>
        <CurriculumAccordion courseId={course.id} lessons={course.lessons} />
      </section>

      {/* Description */}
      <section className="surface p-6 sm:p-8" aria-labelledby="description-heading">
        <h2 id="description-heading" className="section-title">
          Description
        </h2>
        <p className="mt-4 whitespace-pre-line leading-relaxed text-content-muted">{course.description}</p>
        {course.tags && course.tags.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {course.tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
