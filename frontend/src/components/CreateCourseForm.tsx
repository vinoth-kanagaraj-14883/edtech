'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { ErrorAlert, SuccessAlert } from '@/components/Feedback';
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
          <label htmlFor="title" className="block text-sm font-semibold text-content">
            Course title
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
            rows={4}
            required
            placeholder="What will students learn in this course?"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="level" className="block text-sm font-semibold text-content">
              Level
            </label>
            <select id="level" value={level} onChange={(event) => setLevel(event.target.value as typeof level)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="durationHours" className="block text-sm font-semibold text-content">
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
            <label htmlFor="price" className="block text-sm font-semibold text-content">
              Price (USD)
            </label>
            <input id="price" type="number" min={0} step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="thumbnailUrl" className="block text-sm font-semibold text-content">
              Thumbnail URL
            </label>
            <input
              id="thumbnailUrl"
              value={thumbnailUrl}
              onChange={(event) => setThumbnailUrl(event.target.value)}
              placeholder="https://â€¦"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="tags" className="block text-sm font-semibold text-content">
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
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">Lesson {index + 1}</p>
                {lessons.length > 1 ? (
                  <button type="button" onClick={() => removeLesson(index)} className="danger-button px-3 py-1.5 text-xs">
                    Remove
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-content">Lesson title</label>
                <input value={lesson.title} onChange={(event) => updateLesson(index, { title: event.target.value })} />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-content">Short description</label>
                <input value={lesson.description} onChange={(event) => updateLesson(index, { description: event.target.value })} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-content">Content type</label>
                  <select
                    value={lesson.contentType}
                    onChange={(event) => updateLesson(index, { contentType: event.target.value as LessonDraft['contentType'] })}
                  >
                    <option value="article">Article</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-content">Duration (minutes)</label>
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
                  <label className="block text-sm font-semibold text-content">Video URL</label>
                  <input value={lesson.videoUrl} onChange={(event) => updateLesson(index, { videoUrl: event.target.value })} placeholder="https://â€¦" />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-content">Article content</label>
                  <textarea
                    rows={4}
                    value={lesson.articleBody}
                    onChange={(event) => updateLesson(index, { articleBody: event.target.value })}
                    placeholder="Write the lesson content hereâ€¦"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {success ? <SuccessAlert>{success}</SuccessAlert> : null}

      <button type="submit" className="primary-button" disabled={submitting}>
        {submitting ? 'Savingâ€¦' : isEditing ? 'Save changes' : 'Create course'}
      </button>
    </form>
  );
}
