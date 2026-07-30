import Link from 'next/link';

import CreateCourseForm from '@/components/CreateCourseForm';
import { getCourse } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';

interface EditCoursePageProps {
  params: {
    id: string;
  };
}

export default async function EditCoursePage({ params }: EditCoursePageProps) {
  const { token, user } = requireServerAuth();

  if (user.role !== 'instructor') {
    return (
      <div className="surface border border-amber-500/30 bg-amber-500/10 p-8 text-amber-100">
        <p className="text-lg font-semibold text-ink-900">Instructors only</p>
        <p className="mt-2 text-sm">Only instructor accounts can edit courses.</p>
        <Link href="/courses" className="secondary-button mt-4 inline-block">
          Back to courses
        </Link>
      </div>
    );
  }

  try {
    const course = await getCourse(params.id, { token });

    return (
      <div className="space-y-8">
        <section className="surface p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Instructor tools</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink-900">Edit course</h1>
          <p className="mt-4 max-w-3xl text-ink-700">Update your course details below. Lessons are managed separately.</p>
        </section>

        <CreateCourseForm instructorId={course.instructorId ?? user.id} existingCourse={course} />
      </div>
    );
  } catch (error) {
    return <div className="surface border border-rose-500/30 bg-rose-500/10 p-8 text-rose-100">{error instanceof Error ? error.message : 'Unable to load this course.'}</div>;
  }
}
