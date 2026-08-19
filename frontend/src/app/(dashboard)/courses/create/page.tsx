import Link from 'next/link';

import CreateCourseForm from '@/components/CreateCourseForm';
import { PageNotice } from '@/components/Feedback';
import { requireServerAuth } from '@/lib/server-auth';

export default function CreateCoursePage() {
  const { user } = requireServerAuth();

  if (user.role !== 'instructor') {
    return (
      <PageNotice tone="warning" title="Instructors only">
        <p>Only instructor accounts can create new courses.</p>
        <Link href="/courses" className="secondary-button mt-4 inline-flex">
          Back to courses
        </Link>
      </PageNotice>
    );
  }

  return (
    <div className="space-y-8">
      <header className="page-header">
        <p className="eyebrow">Instructor tools</p>
        <h1 className="text-headline text-content">Create a new course</h1>
        <p className="section-subtitle max-w-3xl">
          Add a title, description, and a few lessons. Your course is published immediately and appears in the shared
          course catalog for every student.
        </p>
      </header>

      <CreateCourseForm instructorId={user.id} />
    </div>
  );
}
