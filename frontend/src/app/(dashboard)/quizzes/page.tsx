import Link from 'next/link';

import { getQuizzes } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';

export default async function QuizzesPage() {
  const { token } = requireServerAuth();

  try {
    const quizzes = await getQuizzes({ token });

    return (
      <div className="space-y-8">
        <section className="surface p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-100">Assessments</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Practice quizzes</h1>
          <p className="mt-4 max-w-3xl text-slate-300">Validate understanding, reinforce concepts, and review your scores with structured quizzes.</p>
        </section>

        {quizzes.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {quizzes.map((quiz) => (
              <article key={quiz.id} className="surface flex flex-col gap-5 p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{quiz.questionCount ?? quiz.questions.length} questions</p>
                  <h2 className="mt-3 text-xl font-semibold text-white">{quiz.title}</h2>
                  <p className="mt-3 text-sm text-slate-300">{quiz.description ?? 'Sharpen your knowledge with a focused practice assessment.'}</p>
                </div>
                <Link href={`/quizzes/${quiz.id}`} className="primary-button mt-auto">Start quiz</Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="surface p-8 text-sm text-slate-300">No quizzes are available right now.</div>
        )}
      </div>
    );
  } catch (error) {
    return <div className="surface border border-rose-500/30 bg-rose-500/10 p-8 text-rose-100">{error instanceof Error ? error.message : 'Unable to load quizzes.'}</div>;
  }
}
