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
      <div className="space-y-2">
        <span className="chip-brand">{quiz.questionCount ?? quiz.questions.length} questions · Free preview</span>
        <h3 className="pt-1 text-xl font-bold tracking-tight text-content">{quiz.title}</h3>
        <p className="text-sm leading-relaxed text-content-muted">
          {quiz.description ?? 'Try a few sample questions before you sign up.'}
        </p>
      </div>

      <div className="space-y-3">
        {quiz.questions.slice(0, 3).map((question, index) => {
          const options = question.type === 'true_false' && question.options.length === 0 ? ['True', 'False'] : question.options;

          return (
            <fieldset key={question.id} className="rounded-2xl border border-hairline bg-muted p-4">
              <legend className="sr-only">Question {index + 1}</legend>
              <p className="eyebrow">Question {index + 1}</p>
              <p className="mt-2 text-sm font-semibold leading-snug text-content">{question.prompt}</p>

              {options.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {options.map((option, optionIndex) => {
                    const checked = answers[question.id] === option;

                    return (
                      <label
                        key={option}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition duration-200 ${
                          checked
                            ? 'border-brand-500 bg-brand-50 text-content ring-2 ring-brand-500/25 dark:bg-brand-500/10'
                            : 'border-hairline bg-surface text-content-muted hover:border-brand-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`preview-${quiz.id}-${question.id}`}
                          value={option}
                          checked={checked}
                          onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold transition ${
                            checked
                              ? 'bg-brand-600 text-white'
                              : 'bg-muted text-content-subtle ring-1 ring-inset ring-hairline'
                          }`}
                        >
                          {checked ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m20 6-11 11-5-5" />
                            </svg>
                          ) : (
                            String.fromCharCode(65 + optionIndex)
                          )}
                        </span>
                        <span className="font-medium">{option}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3">
                  <label htmlFor={`preview-answer-${quiz.id}-${question.id}`} className="sr-only">
                    Your answer
                  </label>
                  <input
                    id={`preview-answer-${quiz.id}-${question.id}`}
                    type="text"
                    placeholder="Type your answer…"
                    value={answers[question.id] ?? ''}
                    onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                  />
                </div>
              )}
            </fieldset>
          );
        })}
      </div>

      <div className="mt-auto space-y-3 rounded-2xl border border-brand-500/25 bg-brand-50 p-4 text-sm text-content-muted dark:bg-brand-500/10">
        <p>
          {answeredCount > 0
            ? 'Nice work! Create a free account to submit your answers and see your score.'
            : 'Answer a question above, then create a free account to see your results.'}
        </p>
        <Link href="/register" className="primary-button w-full">
          Sign up to see your results
        </Link>
      </div>
    </div>
  );
}
