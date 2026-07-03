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

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const { token } = requireServerAuth();
  const search = readParam(searchParams?.search) ?? '';
  const level = readParam(searchParams?.level) ?? 'all';

  let courses: Course[] = [];
  let error: string | null = null;

  try {
    courses = await getCourses({ search, level }, { token });
  } catch (courseError) {
    error = courseError instanceof Error ? courseError.message : 'Unable to load courses.';
  }

  return (
    <div className="space-y-8">
      <section className="surface p-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-100">Course catalog</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Explore your next learning path</h1>
          <p className="max-w-3xl text-slate-300">Search the full course library, filter by level, and jump back into the content that matters most.</p>
        </div>

        <form className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input name="search" defaultValue={search} placeholder="Search by title, category, or instructor" />
          <select name="level" defaultValue={level}>
            <option value="all">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <button type="submit" className="primary-button w-full md:w-auto">Apply filters</button>
        </form>
      </section>

      {error ? <div className="surface border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div> : null}

      {courses.length > 0 ? (
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => <CourseCard key={course.id} course={course} />)}
        </section>
      ) : (
        <div className="surface p-8 text-sm text-slate-300">No courses matched your current search. Try another keyword or filter.</div>
      )}
    </div>
  );
}
