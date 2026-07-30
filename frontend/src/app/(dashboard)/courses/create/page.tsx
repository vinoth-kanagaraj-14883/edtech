import Link from 'next/link';

import CreateCourseForm from '@/components/CreateCourseForm';
import { requireServerAuth } from '@/lib/server-auth';

export default function CreateCoursePage() {
  const { user } = requireServerAuth();

  if (user.role !== 'instructor') {
    return (
      <div className="surface border border-amber-500/30 bg-amber-500/10 p-8 text-amber-100">
        <p className="text-lg font-semibold text-ink-900">Instructors only</p>
        <p className="mt-2 text-sm">Only instructor accounts can create new courses.</p>
        <Link href="/courses" className="secondary-button mt-4 inline-block">
          Back to courses
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="surface p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Instructor tools</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink-900">Create a new course</h1>
        <p className="mt-4 max-w-3xl text-ink-700">
          Add a title, description, and a few lessons. Your course is published immediately and appears in
          the shared course catalog for every student.
        </p>
      </section>

      <CreateCourseForm instructorId={user.id} />
    </div>
  );
}
