import Link from 'next/link';

import CourseCard from '@/components/CourseCard';
import { getCourses } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';
import type { Course } from '@/types';

interface CoursesPageProps {
  searchParams?: {
    search?: string | string[];
    level?: string | string[];
  };
}

const readParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

const LEVELS = [
  { value: 'all', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' }
];

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const { token, user } = requireServerAuth();
  const search = readParam(searchParams?.search) ?? '';
  const level = readParam(searchParams?.level) ?? 'all';

  let courses: Course[] = [];
  let error: string | null = null;

  try {
    courses = await getCourses({ search, level }, { token });
  } catch (courseError) {
    error = courseError instanceof Error ? courseError.message : 'Unable to load courses.';
  }

  const isInstructor = user.role === 'instructor';
  const myCourses = isInstructor ? courses.filter((course) => course.instructorId === user.id) : [];

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="page-header sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="eyebrow">{isInstructor ? 'Instructor workspace' : 'Course catalog'}</p>
          <h1 className="text-headline text-content">
            {isInstructor ? 'Manage your courses' : 'Explore your next learning path'}
          </h1>
          <p className="section-subtitle max-w-3xl">
            {isInstructor
              ? 'Create new courses, edit existing content, and see what every student can browse and enroll in.'
              : 'Search the full library, filter by level, and jump back into what matters most.'}
          </p>
        </div>
        {isInstructor ? (
          <Link href="/courses/create" className="primary-button self-start whitespace-nowrap sm:self-auto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create course
          </Link>
        ) : null}
      </header>

      {/* Instructor's own courses */}
      {isInstructor ? (
        <section className="space-y-5" aria-labelledby="my-courses-heading">
          <h2 id="my-courses-heading" className="section-title">
            Your courses
          </h2>
          {myCourses.length > 0 ? (
            <div className="stagger grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {myCourses.map((course) => (
                <CourseCard key={course.id} course={course} currentUserId={user.id} currentUserRole={user.role} />
              ))}
            </div>
          ) : (
            <div className="surface flex flex-col items-center gap-4 px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300 dark:ring-brand-400/25">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-content">No courses yet</h3>
                <p className="section-subtitle mx-auto max-w-sm">
                  Publish your first course to start reaching learners.
                </p>
              </div>
              <Link href="/courses/create" className="primary-button">
                Create your first course
              </Link>
            </div>
          )}
        </section>
      ) : null}

      {/* Filter bar */}
      <section className="surface p-4 sm:p-5" aria-label="Filter courses">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto]">
          <div className="relative">
            <label htmlFor="course-search" className="sr-only">
              Search courses
            </label>
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="9" cy="9" r="6" />
                <path d="m14 14 4 4" strokeLinecap="round" />
              </svg>
            </span>
            <input
              id="course-search"
              name="search"
              defaultValue={search}
              placeholder="Search by title, category, or instructor"
              className="pl-10"
            />
          </div>
          <div>
            <label htmlFor="course-level" className="sr-only">
              Filter by level
            </label>
            <select id="course-level" name="level" defaultValue={level}>
              {LEVELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="primary-button w-full md:w-auto">
            Apply
          </button>
        </form>
      </section>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-danger-500/25 bg-danger-50 px-4 py-3.5 text-sm text-danger-600 dark:bg-danger-500/10"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-px shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4.5M12 16h.01" />
          </svg>
          <span>{error}</span>
        </div>
      ) : null}

      {/* Results */}
      <section className="space-y-5" aria-labelledby="results-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="results-heading" className="section-title">
            {isInstructor ? 'Full catalog' : 'All courses'}
          </h2>
          <p className="chip">
            {courses.length} {courses.length === 1 ? 'result' : 'results'}
            {search ? ` for “${search}”` : ''}
          </p>
        </div>

        {courses.length > 0 ? (
          <div className="stagger grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                currentUserId={user.id}
                currentUserRole={user.role}
                showUnenroll={!isInstructor}
              />
            ))}
          </div>
        ) : (
          <div className="surface flex flex-col items-center gap-4 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-content-subtle ring-1 ring-inset ring-hairline">
              <svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <circle cx="9" cy="9" r="6" />
                <path d="m14 14 4 4" strokeLinecap="round" />
              </svg>
            </span>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-content">No courses found</h3>
              <p className="section-subtitle mx-auto max-w-sm">
                No courses matched your current search. Try another keyword or filter.
              </p>
            </div>
            <Link href="/courses" className="secondary-button">
              Clear filters
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
