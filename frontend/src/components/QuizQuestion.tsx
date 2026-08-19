'use client';

import type { Question } from '@/types';

interface QuizQuestionProps {
  question: Question;
  selectedAnswer?: string;
  index: number;
  onChange: (questionId: string, answer: string) => void;
}

export default function QuizQuestion({ question, selectedAnswer, index, onChange }: QuizQuestionProps) {
  const options = question.type === 'true_false' && question.options.length === 0 ? ['True', 'False'] : question.options;

  return (
    <fieldset className="surface space-y-5 p-6">
      <legend className="sr-only">Question {index + 1}</legend>
      <div className="space-y-2">
        <p className="eyebrow">Question {index + 1}</p>
        <h3 className="text-lg font-bold leading-snug tracking-tight text-content">{question.prompt}</h3>
      </div>

      {options.length > 0 ? (
        <div className="space-y-2.5">
          {options.map((option, optionIndex) => {
            const checked = selectedAnswer === option;

            return (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 text-sm transition duration-200 ${
                  checked
                    ? 'border-brand-500 bg-brand-50 text-content ring-2 ring-brand-500/25 dark:bg-brand-500/10'
                    : 'border-hairline bg-surface text-content-muted hover:-translate-y-0.5 hover:border-brand-300'
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={checked}
                  onChange={() => onChange(question.id, option)}
                  className="sr-only"
                />
                {/* Letter marker doubles as the selection indicator. */}
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition ${
                    checked
                      ? 'bg-brand-600 text-white'
                      : 'bg-muted text-content-subtle ring-1 ring-inset ring-hairline'
                  }`}
                >
                  {checked ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
        <div>
          <label htmlFor={`answer-${question.id}`} className="sr-only">
            Your answer
          </label>
          <input
            id={`answer-${question.id}`}
            type="text"
            value={selectedAnswer ?? ''}
            onChange={(event) => onChange(question.id, event.target.value)}
            placeholder="Type your answer…"
          />
        </div>
      )}
    </fieldset>
  );
}
