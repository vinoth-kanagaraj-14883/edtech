'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { Quiz } from '@/types';

interface PublicQuizPreviewProps {
  quiz: Quiz;
}

export default function PublicQuizPreview({ quiz }: PublicQuizPreviewProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const answeredCount = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);

  return (
    <div className="surface flex flex-col gap-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-500">
          {quiz.questionCount ?? quiz.questions.length} questions · Free preview
        </p>
        <h3 className="mt-3 text-xl font-semibold text-ink-900">{quiz.title}</h3>
        <p className="mt-3 text-sm text-ink-700">{quiz.description ?? 'Try a few sample questions before you sign up.'}</p>
      </div>

      <div className="space-y-4">
        {quiz.questions.slice(0, 3).map((question, index) => {
          const options = question.type === 'true_false' && question.options.length === 0 ? ['True', 'False'] : question.options;

          return (
            <div key={question.id} className="rounded-2xl border border-ink-300/60 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Question {index + 1}</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{question.prompt}</p>

              {options.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {options.map((option) => {
                    const checked = answers[question.id] === option;

                    return (
                      <label
                        key={option}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${checked ? 'border-brand-500 bg-brand-50 text-ink-900' : 'border-ink-300/60 bg-white text-ink-700 hover:border-brand-400'}`}
                      >
                        <input
                          type="radio"
                          name={`preview-${quiz.id}-${question.id}`}
                          value={option}
                          checked={checked}
                          onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                          className="h-4 w-4 accent-cyan-400"
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Type your answer…"
                  value={answers[question.id] ?? ''}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                  className="mt-3 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-auto space-y-3 rounded-2xl border border-brand-500/30 bg-brand-500/10 p-4 text-sm text-ink-700">
        <p>
          {answeredCount > 0
            ? "Nice work! Create a free account to submit your answers and see your score."
            : 'Answer a question above, then create a free account to see your results.'}
        </p>
        <Link href="/register" className="primary-button w-full text-center">
          Sign up to see your results
        </Link>
      </div>
    </div>
  );
}
