import Link from 'next/link';

import CreateQuizForm from '@/components/CreateQuizForm';
import { requireServerAuth } from '@/lib/server-auth';

export default function CreateQuizPage() {
  const { user } = requireServerAuth();

  if (user.role !== 'instructor') {
    return (
      <div className="surface border border-amber-500/30 bg-amber-500/10 p-8 text-amber-100">
        <p className="text-lg font-semibold text-white">Instructors only</p>
        <p className="mt-2 text-sm">Only instructor accounts can create new quizzes.</p>
        <Link href="/quizzes" className="secondary-button mt-4 inline-block">
          Back to quizzes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="surface p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-100">Instructor tools</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Create a new quiz</h1>
        <p className="mt-4 max-w-3xl text-slate-300">
          Add a title, description, and a few questions. Your quiz is published immediately and appears in
          the shared quiz catalog for every student.
        </p>
      </section>

      <CreateQuizForm />
    </div>
  );
}
