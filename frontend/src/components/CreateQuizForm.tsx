'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { ErrorAlert, SuccessAlert } from '@/components/Feedback';
import { createQuiz, type CreateQuizInput, type QuizQuestionInput } from '@/lib/api';

const emptyQuestion = (): QuizQuestionInput => ({
  text: '',
  questionType: 'multiple_choice',
  options: ['', '', '', ''],
  correctAnswer: '',
  points: 1
});

const DEMO_COURSE_ID = '33333333-3333-3333-3333-333333333333';

export default function CreateQuizForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [passingScore, setPassingScore] = useState(60);
  const [questions, setQuestions] = useState<QuizQuestionInput[]>([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const updateQuestion = (index: number, patch: Partial<QuizQuestionInput>) => {
    setQuestions((current) => current.map((question, i) => (i === index ? { ...question, ...patch } : question)));
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions((current) =>
      current.map((question, i) => {
        if (i !== questionIndex) return question;
        const options = [...(question.options ?? [])];
        options[optionIndex] = value;
        return { ...question, options };
      })
    );
  };

  const addQuestion = () => setQuestions((current) => [...current, emptyQuestion()]);

  const removeQuestion = (index: number) => {
    setQuestions((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const input: CreateQuizInput = {
        courseId: DEMO_COURSE_ID,
        title,
        description,
        timeLimitMinutes,
        passingScore,
        isPublished: true,
        questions: questions.map((question, index) => ({
          ...question,
          orderIndex: index,
          options: question.questionType === 'short_answer' ? undefined : (question.options ?? []).filter(Boolean)
        }))
      };

      const quiz = await createQuiz(input);
      setSuccess(`"${quiz.title}" was created with ${quiz.questions.length} question(s).`);
      setTitle('');
      setDescription('');
      setQuestions([emptyQuestion()]);
      setTimeout(() => router.push(`/quizzes/${quiz.id}`), 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="surface space-y-5 p-6">
        <div className="space-y-2">
          <label htmlFor="title" className="block text-sm font-semibold text-content">
            Quiz title
          </label>
          <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="block text-sm font-semibold text-content">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="What will students practice in this quiz?"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="timeLimit" className="block text-sm font-semibold text-content">
              Time limit (minutes)
            </label>
            <input
              id="timeLimit"
              type="number"
              min={1}
              value={timeLimitMinutes}
              onChange={(event) => setTimeLimitMinutes(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="passingScore" className="block text-sm font-semibold text-content">
              Passing score (%)
            </label>
            <input
              id="passingScore"
              type="number"
              min={0}
              max={100}
              value={passingScore}
              onChange={(event) => setPassingScore(Number(event.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={index} className="surface space-y-4 p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">Question {index + 1}</p>
              {questions.length > 1 ? (
                <button type="button" onClick={() => removeQuestion(index)} className="danger-button px-3 py-1.5 text-xs">
                  Remove
                </button>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-content">Question text</label>
              <input value={question.text} onChange={(event) => updateQuestion(index, { text: event.target.value })} required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-content">Question type</label>
                <select
                  value={question.questionType}
                  onChange={(event) =>
                    updateQuestion(index, {
                      questionType: event.target.value as QuizQuestionInput['questionType'],
                      options: event.target.value === 'true_false' ? ['True', 'False'] : ['', '', '', '']
                    })
                  }
                >
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="true_false">True / False</option>
                  <option value="short_answer">Short answer</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-content">Points</label>
                <input
                  type="number"
                  min={1}
                  value={question.points ?? 1}
                  onChange={(event) => updateQuestion(index, { points: Number(event.target.value) })}
                />
              </div>
            </div>

            {question.questionType === 'multiple_choice' ? (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-content">Options</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(question.options ?? []).map((option, optionIndex) => (
                    <input
                      key={optionIndex}
                      value={option}
                      onChange={(event) => updateOption(index, optionIndex, event.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-content">Correct answer</label>
              {question.questionType === 'true_false' ? (
                <select value={question.correctAnswer} onChange={(event) => updateQuestion(index, { correctAnswer: event.target.value })}>
                  <option value="">Selectâ€¦</option>
                  <option value="True">True</option>
                  <option value="False">False</option>
                </select>
              ) : (
                <input
                  value={question.correctAnswer}
                  onChange={(event) => updateQuestion(index, { correctAnswer: event.target.value })}
                  placeholder={question.questionType === 'multiple_choice' ? 'Must match one of the options above' : 'Expected answer text'}
                  required
                />
              )}
            </div>
          </div>
        ))}

        <button type="button" onClick={addQuestion} className="secondary-button">
          + Add another question
        </button>
      </div>

      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {success ? <SuccessAlert>{success}</SuccessAlert> : null}

      <button type="submit" className="primary-button" disabled={submitting}>
        {submitting ? 'Creating quizâ€¦' : 'Create quiz'}
      </button>
    </form>
  );
}
