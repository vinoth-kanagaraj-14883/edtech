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
    <div className="surface space-y-5 p-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">Question {index + 1}</p>
        <h3 className="text-lg font-semibold text-ink-900">{question.prompt}</h3>
      </div>

      {options.length > 0 ? (
        <div className="space-y-3">
          {options.map((option) => {
            const checked = selectedAnswer === option;

            return (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${checked ? 'border-brand-500 bg-brand-50 text-ink-900' : 'border-ink-300/60 bg-white text-ink-700 hover:border-brand-400'}`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={checked}
                  onChange={() => onChange(question.id, option)}
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
          value={selectedAnswer ?? ''}
          onChange={(event) => onChange(question.id, event.target.value)}
          placeholder="Type your answer…"
          className="w-full rounded-md border border-ink-300 bg-white px-4 py-3 text-sm text-ink-900 placeholder:text-ink-500"
        />
      )}
    </div>
  );
}
