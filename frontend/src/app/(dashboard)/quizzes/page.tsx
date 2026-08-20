import Link from 'next/link';

import { getQuizzes } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';

export default async function QuizzesPage() {
  const { token, user } = requireServerAuth();

  try {
    const quizzes = await getQuizzes({ token });

    return (
      <div className="space-y-10">
        <header className="page-header sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="eyebrow">Assessments</p>
            <h1 className="text-headline text-content">Practice quizzes</h1>
            <p className="section-subtitle max-w-3xl">
              Validate understanding, reinforce concepts, and review your scores with structured quizzes.
            </p>
          </div>
          {user.role === 'instructor' ? (
            <Link href="/quizzes/create" className="primary-button self-start whitespace-nowrap sm:self-auto">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create quiz
            </Link>
          ) : null}
        </header>

        {quizzes.length > 0 ? (
          <div className="stagger grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {quizzes.map((quiz) => {
              const questionCount = quiz.questionCount ?? quiz.questions.length;
              return (
                <article key={quiz.id} className="surface-hover group flex flex-col gap-4 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="chip-brand">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                    </span>
                    <span className="text-xs font-medium text-content-subtle">
                      ~{Math.max(1, Math.round(questionCount * 0.75))} min
                    </span>
                  </div>

                  <div className="flex-1 space-y-2">
                    <h2 className="text-lg font-bold leading-snug tracking-tight text-content transition group-hover:text-brand-600">
                      {quiz.title}
                    </h2>
                    <p className="text-sm leading-relaxed text-content-muted">
                      {quiz.description ?? 'Sharpen your knowledge with a focused practice assessment.'}
                    </p>
                  </div>

                  <Link href={`/quizzes/${quiz.id}`} className="primary-button mt-auto w-full">
                    Start quiz
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="surface flex flex-col items-center gap-4 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/25">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </span>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-content">No quizzes yet</h2>
              <p className="section-subtitle mx-auto max-w-sm">
                No quizzes are available right now. Check back soon.
              </p>
            </div>
            {user.role === 'instructor' ? (
              <Link href="/quizzes/create" className="primary-button">
                Create the first quiz
              </Link>
            ) : null}
          </div>
        )}
      </div>
    );
  } catch (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2.5 rounded-xl border border-danger-500/25 bg-danger-50 px-4 py-3.5 text-sm text-danger-600 dark:bg-danger-500/10"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-px shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4.5M12 16h.01" />
        </svg>
        <span>{error instanceof Error ? error.message : 'Unable to load quizzes.'}</span>
      </div>
    );
  }
}
