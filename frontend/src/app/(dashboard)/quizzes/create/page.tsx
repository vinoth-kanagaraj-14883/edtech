import Link from 'next/link';

import CreateQuizForm from '@/components/CreateQuizForm';
import { PageNotice } from '@/components/Feedback';
import { requireServerAuth } from '@/lib/server-auth';

export default function CreateQuizPage() {
  const { user } = requireServerAuth();

  if (user.role !== 'instructor') {
    return (
      <PageNotice tone="warning" title="Instructors only">
        <p>Only instructor accounts can create new quizzes.</p>
        <Link href="/quizzes" className="secondary-button mt-4 inline-flex">
          Back to quizzes
        </Link>
      </PageNotice>
    );
  }

  return (
    <div className="space-y-8">
      <header className="page-header">
        <p className="eyebrow">Instructor tools</p>
        <h1 className="text-headline text-content">Create a new quiz</h1>
        <p className="section-subtitle max-w-3xl">
          Add a title, description, and a few questions. Your quiz is published immediately and appears in the shared
          quiz catalog for every student.
        </p>
      </header>

      <CreateQuizForm />
    </div>
  );
}
