import Link from 'next/link';

import CreateCourseForm from '@/components/CreateCourseForm';
import { PageNotice } from '@/components/Feedback';
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
      <PageNotice tone="warning" title="Instructors only">
        <p>Only instructor accounts can edit courses.</p>
        <Link href="/courses" className="secondary-button mt-4 inline-flex">
          Back to courses
        </Link>
      </PageNotice>
    );
  }

  try {
    const course = await getCourse(params.id, { token });

    return (
      <div className="space-y-8">
        <header className="page-header">
          <p className="eyebrow">Instructor tools</p>
          <h1 className="text-headline text-content">Edit course</h1>
          <p className="section-subtitle max-w-3xl">
            Update your course details below. Lessons are managed separately.
          </p>
        </header>

        <CreateCourseForm instructorId={course.instructorId ?? user.id} existingCourse={course} />
      </div>
    );
  } catch (error) {
    return (
      <PageNotice title="Unable to load this course">
        <p>{error instanceof Error ? error.message : 'Unable to load this course.'}</p>
      </PageNotice>
    );
  }
}
