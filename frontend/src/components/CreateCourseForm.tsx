'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { createCourse, createLesson, updateCourse, type CreateCourseInput } from '@/lib/api';
import type { Course } from '@/types';

interface LessonDraft {
  title: string;
  description: string;
  durationMinutes: number;
  contentType: 'article' | 'video';
  articleBody: string;
  videoUrl: string;
}

const emptyLesson = (): LessonDraft => ({
  title: '',
  description: '',
  durationMinutes: 10,
  contentType: 'article',
  articleBody: '',
  videoUrl: ''
});

interface CreateCourseFormProps {
  instructorId: string;
  existingCourse?: Course;
}

export default function CreateCourseForm({ instructorId, existingCourse }: CreateCourseFormProps) {
  const router = useRouter();
  const isEditing = Boolean(existingCourse);

  const [title, setTitle] = useState(existingCourse?.title ?? '');
  const [description, setDescription] = useState(existingCourse?.description ?? '');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>(
    existingCourse && existingCourse.level !== 'all-levels' ? existingCourse.level : 'beginner'
  );
  const [durationHours, setDurationHours] = useState(existingCourse?.durationHours ?? 10);
  const [price, setPrice] = useState(existingCourse?.price ?? 0);
  const [thumbnailUrl, setThumbnailUrl] = useState(existingCourse?.thumbnailUrl ?? '');
  const [tags, setTags] = useState((existingCourse?.tags ?? []).join(', '));
  const [lessons, setLessons] = useState<LessonDraft[]>(isEditing ? [] : [emptyLesson()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const updateLesson = (index: number, patch: Partial<LessonDraft>) => {
    setLessons((current) => current.map((lesson, i) => (i === index ? { ...lesson, ...patch } : lesson)));
  };

  const addLesson = () => setLessons((current) => [...current, emptyLesson()]);

  const removeLesson = (index: number) => setLessons((current) => current.filter((_, i) => i !== index));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const input: CreateCourseInput = {
        title,
        description,
        instructorId,
        price,
        durationHours,
        level,
        status: 'PUBLISHED',
        thumbnailUrl: thumbnailUrl || undefined,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      };

      const course = isEditing && existingCourse ? await updateCourse(existingCourse.id, input) : await createCourse(input);

      for (const [index, lesson] of lessons.entries()) {
        if (!lesson.title.trim()) continue;
        await createLesson({
          courseId: course.id,
          title: lesson.title,
          description: lesson.description || undefined,
          orderIndex: index,
          durationMinutes: lesson.durationMinutes,
          articleBody: lesson.contentType === 'article' ? lesson.articleBody || undefined : undefined,
          videoUrl: lesson.contentType === 'video' ? lesson.videoUrl || undefined : undefined
        });
      }

      setSuccess(`"${course.title}" was ${isEditing ? 'updated' : 'created'} successfully.`);
      setTimeout(() => router.push(`/courses/${course.id}`), 1000);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save this course.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="surface space-y-5 p-6">
        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium text-slate-200">
            Course title
          </label>
          <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium text-slate-200">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            required
            className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500"
            placeholder="What will students learn in this course?"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="level" className="text-sm font-medium text-slate-200">
              Level
            </label>
            <select id="level" value={level} onChange={(event) => setLevel(event.target.value as typeof level)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="durationHours" className="text-sm font-medium text-slate-200">
              Duration (hours)
            </label>
            <input
              id="durationHours"
              type="number"
              min={1}
              value={durationHours}
              onChange={(event) => setDurationHours(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="price" className="text-sm font-medium text-slate-200">
              Price (USD)
            </label>
            <input id="price" type="number" min={0} step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="thumbnailUrl" className="text-sm font-medium text-slate-200">
              Thumbnail URL
            </label>
            <input
              id="thumbnailUrl"
              value={thumbnailUrl}
              onChange={(event) => setThumbnailUrl(event.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="tags" className="text-sm font-medium text-slate-200">
              Tags (comma separated)
            </label>
            <input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="cloud, azure, beginner" />
          </div>
        </div>
      </div>

      {!isEditing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Lessons</h2>
            <button type="button" onClick={addLesson} className="secondary-button">
              + Add lesson
            </button>
          </div>

          {lessons.map((lesson, index) => (
            <div key={index} className="surface space-y-4 p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-100">Lesson {index + 1}</p>
                {lessons.length > 1 ? (
                  <button type="button" onClick={() => removeLesson(index)} className="text-xs font-medium text-rose-300 hover:text-rose-200">
                    Remove
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Lesson title</label>
                <input value={lesson.title} onChange={(event) => updateLesson(index, { title: event.target.value })} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Short description</label>
                <input value={lesson.description} onChange={(event) => updateLesson(index, { description: event.target.value })} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Content type</label>
                  <select
                    value={lesson.contentType}
                    onChange={(event) => updateLesson(index, { contentType: event.target.value as LessonDraft['contentType'] })}
                  >
                    <option value="article">Article</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Duration (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    value={lesson.durationMinutes}
                    onChange={(event) => updateLesson(index, { durationMinutes: Number(event.target.value) })}
                  />
                </div>
              </div>

              {lesson.contentType === 'video' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Video URL</label>
                  <input value={lesson.videoUrl} onChange={(event) => updateLesson(index, { videoUrl: event.target.value })} placeholder="https://…" />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Article content</label>
                  <textarea
                    rows={4}
                    value={lesson.articleBody}
                    onChange={(event) => updateLesson(index, { articleBody: event.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                    placeholder="Write the lesson content here…"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

      <button type="submit" className="primary-button" disabled={submitting}>
        {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create course'}
      </button>
    </form>
  );
}
