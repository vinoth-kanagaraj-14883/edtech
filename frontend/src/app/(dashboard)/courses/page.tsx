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
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-6">
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-600">
            {isInstructor ? 'Instructor workspace' : 'Course catalog'}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {isInstructor ? 'Manage your courses' : 'Explore your next learning path'}
          </h1>
          <p className="max-w-3xl text-ink-700">
            {isInstructor
              ? 'Create new courses, edit existing content, and see what every student can browse and enroll in.'
              : 'Search the full library, filter by level, and jump back into what matters most.'}
          </p>
        </div>
        {isInstructor ? (
          <Link href="/courses/create" className="primary-button whitespace-nowrap">
            + Create course
          </Link>
        ) : null}
      </section>

      {/* Instructor's own courses */}
      {isInstructor ? (
        <section className="space-y-4">
          <h2 className="section-title">Your courses</h2>
          {myCourses.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {myCourses.map((course) => (
                <CourseCard key={course.id} course={course} currentUserId={user.id} currentUserRole={user.role} />
              ))}
            </div>
          ) : (
            <div className="surface p-8 text-sm text-ink-700">
              You haven&apos;t created any courses yet. Use the &quot;Create course&quot; button above to publish your first one.
            </div>
          )}
        </section>
      ) : null}

      {/* Filter bar */}
      <section className="rounded-lg border border-ink-300/60 bg-muted p-5">
        <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-500">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="9" r="6" />
                <path d="m14 14 4 4" strokeLinecap="round" />
              </svg>
            </span>
            <input
              name="search"
              defaultValue={search}
              placeholder="Search by title, category, or instructor"
              className="pl-11"
            />
          </div>
          <select name="level" defaultValue={level}>
            {LEVELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="submit" className="primary-button w-full md:w-auto">
            Apply filters
          </button>
        </form>
      </section>

      {error ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      ) : null}

      {/* Results */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="section-title">{isInstructor ? 'Full catalog' : 'All courses'}</h2>
          <p className="text-sm text-ink-500">
            {courses.length} {courses.length === 1 ? 'result' : 'results'}
            {search ? ` for “${search}”` : ''}
          </p>
        </div>

        {courses.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
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
          <div className="surface p-8 text-sm text-ink-700">
            No courses matched your current search. Try another keyword or filter.
          </div>
        )}
      </section>
    </div>
  );
}
