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
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-100">Question {index + 1}</p>
        <h3 className="text-lg font-semibold text-white">{question.prompt}</h3>
      </div>

      <div className="space-y-3">
        {options.map((option) => {
          const checked = selectedAnswer === option;

          return (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${checked ? 'border-brand-500 bg-brand-500/10 text-white' : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'}`}
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
    </div>
  );
}
