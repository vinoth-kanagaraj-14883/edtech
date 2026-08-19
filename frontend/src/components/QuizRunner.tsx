'use client';

import { useMemo, useState } from 'react';

import { ErrorAlert, Spinner } from '@/components/Feedback';
import QuizQuestion from '@/components/QuizQuestion';
import { submitQuiz } from '@/lib/api';
import type { Quiz, Submission } from '@/types';

interface QuizRunnerProps {
  quiz: Quiz;
  userId: string;
}

export default function QuizRunner({ quiz, userId }: QuizRunnerProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Submission | null>(null);

  const answeredCount = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);

  const handleChange = (questionId: string, answer: string) => {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const payload: Submission = {
        quizId: quiz.id,
        userId,
        answers: quiz.questions.map((question) => ({
          questionId: question.id,
          answer: answers[question.id] ?? ''
        }))
      };

      const submission = await submitQuiz(quiz.id, payload);
      setResult(submission);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="surface space-y-4 p-6">
        <div className="space-y-2">
          <p className="eyebrow">Assessment</p>
          <h1 className="text-headline text-content">{quiz.title}</h1>
          {quiz.description ? (
            <p className="section-subtitle max-w-2xl">{quiz.description}</p>
          ) : null}
        </div>

        {/* Answer progress */}
        <div className="space-y-1.5 border-t border-hairline pt-4">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-content-subtle">Progress</span>
            <span className="text-brand-600">
              {answeredCount} of {quiz.questions.length} answered
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-hairline"
            role="progressbar"
            aria-valuenow={answeredCount}
            aria-valuemin={0}
            aria-valuemax={quiz.questions.length}
            aria-label="Questions answered"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-500 ease-smooth"
              style={{ width: `${quiz.questions.length ? (answeredCount / quiz.questions.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {quiz.questions.map((question, index) => (
          <QuizQuestion key={question.id} question={question} index={index} selectedAnswer={answers[question.id]} onChange={handleChange} />
        ))}
      </div>

      <div className="surface space-y-4 p-6">
        <button
          type="button"
          onClick={handleSubmit}
          className="primary-button w-full py-3 sm:w-auto"
          disabled={submitting || answeredCount !== quiz.questions.length}
        >
          {submitting ? (
            <>
              <Spinner />
              Submitting…
            </>
          ) : (
            'Submit quiz'
          )}
        </button>
        {answeredCount !== quiz.questions.length ? (
          <p className="text-sm text-content-subtle">Answer every question before submitting.</p>
        ) : null}
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
        {result ? (
          <div className="animate-scale-in rounded-2xl border border-success-500/25 bg-success-50 p-6 dark:bg-success-500/10">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-500 text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m20 6-11 11-5-5" />
                </svg>
              </span>
              <div>
                <p className="text-lg font-bold text-content">Quiz complete</p>
                <p className="text-sm text-content-muted">Here&apos;s how you did.</p>
              </div>
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-surface p-4 ring-1 ring-inset ring-hairline">
                <dt className="stat-label">Score</dt>
                <dd className="stat-value mt-1">
                  {result.score ?? 0}
                  {typeof result.totalQuestions === 'number' ? (
                    <span className="text-lg font-bold text-content-subtle"> / {result.totalQuestions}</span>
                  ) : null}
                </dd>
              </div>
              {typeof result.correctCount === 'number' ? (
                <div className="rounded-xl bg-surface p-4 ring-1 ring-inset ring-hairline">
                  <dt className="stat-label">Correct answers</dt>
                  <dd className="stat-value mt-1">{result.correctCount}</dd>
                </div>
              ) : null}
            </dl>

            {result.feedback ? (
              <p className="mt-4 text-sm leading-relaxed text-content-muted">{result.feedback}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
