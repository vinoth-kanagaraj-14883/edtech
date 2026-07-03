'use client';

import { useMemo, useState } from 'react';

import QuizQuestion from '@/components/QuizQuestion';
import { submitQuiz } from '@/lib/api';
import type { Quiz, Submission } from '@/types';

interface QuizRunnerProps {
  quiz: Quiz;
}

export default function QuizRunner({ quiz }: QuizRunnerProps) {
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
      <div className="surface flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-100">Assessment</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{quiz.title}</h1>
          {quiz.description ? <p className="mt-3 text-slate-300">{quiz.description}</p> : null}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
          {answeredCount}/{quiz.questions.length} answered
        </div>
      </div>

      <div className="space-y-4">
        {quiz.questions.map((question, index) => (
          <QuizQuestion key={question.id} question={question} index={index} selectedAnswer={answers[question.id]} onChange={handleChange} />
        ))}
      </div>

      <div className="surface space-y-4 p-6">
        <button type="button" onClick={handleSubmit} className="primary-button" disabled={submitting || answeredCount !== quiz.questions.length}>
          {submitting ? 'Submitting…' : 'Submit quiz'}
        </button>
        {answeredCount !== quiz.questions.length ? <p className="text-sm text-slate-400">Answer every question before submitting.</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {result ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-100">
            <p className="text-lg font-semibold text-white">Results</p>
            <p className="mt-2">
              Score: {result.score ?? 0}
              {typeof result.totalQuestions === 'number' ? ` / ${result.totalQuestions}` : ''}
            </p>
            {typeof result.correctCount === 'number' ? <p className="mt-1">Correct answers: {result.correctCount}</p> : null}
            {result.feedback ? <p className="mt-3">{result.feedback}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
