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
      <div className="rounded-lg border border-rose-300 bg-rose-50 p-8 text-rose-700">
        {error instanceof Error ? error.message : 'Unable to load the selected course.'}
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
      <section className="-mx-4 bg-ink-900 px-4 py-10 text-white sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="max-w-3xl space-y-4">
            <nav className="flex flex-wrap items-center gap-2 text-sm text-ink-300">
              <Link href="/courses" className="hover:text-white">
                Courses
              </Link>
              {course.category ? (
                <>
                  <span>/</span>
                  <Link
                    href={{ pathname: '/courses', query: { search: course.category } }}
                    className="hover:text-white"
                  >
                    {course.category}
                  </Link>
                </>
              ) : null}
            </nav>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{course.title}</h1>
            <p className="text-lg text-ink-300">{course.shortDescription ?? course.description}</p>

            <div className="flex flex-wrap items-center gap-3">
              {bestseller ? <span className="badge-bestseller">Bestseller</span> : null}
              <StarRating value={rating} count={ratingCount} size="md" onDark />
              <span className="text-sm text-ink-300">{studentCount.toLocaleString()} students</span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-300">
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
            <div className="overflow-hidden rounded-lg border border-ink-300/40 bg-white text-ink-900 shadow-card lg:sticky lg:top-24">
              <div className="relative aspect-video w-full">
                {course.thumbnailUrl ? (
                  <Image
                    src={course.thumbnailUrl}
                    alt={course.title}
                    fill
                    sizes="360px"
                    className="object-cover"
                  />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} p-4`}>
                    <span className="line-clamp-3 text-center text-lg font-extrabold leading-tight text-white drop-shadow">
                      {course.title}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4 p-6">
                <p className="text-3xl font-extrabold text-ink-900">{formatPrice(course.price)}</p>

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

                <ul className="space-y-2 border-t border-ink-300/50 pt-4 text-sm text-ink-700">
                  <li className="flex justify-between">
                    <span>Lessons</span>
                    <span className="font-semibold text-ink-900">{course.lessons.length}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Quizzes</span>
                    <span className="font-semibold text-ink-900">{course.quizIds?.length ?? 0}</span>
                  </li>
                  {totalMinutes > 0 ? (
                    <li className="flex justify-between">
                      <span>Total length</span>
                      <span className="font-semibold text-ink-900">{totalMinutes} min</span>
                    </li>
                  ) : null}
                  <li className="flex justify-between">
                    <span>Level</span>
                    <span className="font-semibold capitalize text-ink-900">{course.level.replace('-', ' ')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* What you'll learn */}
      <section className="surface p-8">
        <h2 className="section-title">What you&apos;ll learn</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {outcomes.map((outcome) => (
            <li key={outcome} className="flex items-start gap-3 text-sm text-ink-800">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" className="mt-0.5 shrink-0 text-brand-500">
                <path d="m5 10 3.5 3.5L15 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{outcome}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Course content / curriculum */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Course content</h2>
          <p className="text-sm text-ink-500">
            {course.lessons.length} lectures{totalMinutes > 0 ? ` • ${totalMinutes} min total` : ''}
          </p>
        </div>
        <CurriculumAccordion courseId={course.id} lessons={course.lessons} />
      </section>

      {/* Description */}
      <section className="surface p-8">
        <h2 className="section-title">Description</h2>
        <p className="mt-4 whitespace-pre-line text-ink-700">{course.description}</p>
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
