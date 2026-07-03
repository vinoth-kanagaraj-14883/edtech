import Link from 'next/link';

import LessonCompletionButton from '@/components/LessonCompletionButton';
import { getCourse, getLesson } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';

interface LessonPageProps {
  params: {
    id: string;
    lessonId: string;
  };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { token } = requireServerAuth();

  try {
    const [course, lesson] = await Promise.all([
      getCourse(params.id, { token }),
      getLesson(params.id, params.lessonId, { token })
    ]);
    const currentIndex = course.lessons.findIndex((item) => item.id === lesson.id);
    const nextLesson = currentIndex >= 0 ? course.lessons[currentIndex + 1] : undefined;

    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <Link href={`/courses/${course.id}`} className="hover:text-white">{course.title}</Link>
          <span>→</span>
          <span className="text-white">{lesson.title}</span>
        </div>

        <section className="surface overflow-hidden">
          <div className="flex h-[320px] items-center justify-center bg-gradient-to-br from-slate-900 via-brand-700/20 to-slate-950">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-100">Video lesson</p>
              <h1 className="mt-3 text-3xl font-semibold text-white">{lesson.title}</h1>
              <p className="mt-3 text-sm text-slate-300">Video player placeholder</p>
            </div>
          </div>

          <div className="grid gap-8 p-8 lg:grid-cols-[minmax(0,2fr)_320px]">
            <div className="space-y-6">
              <div>
                <h2 className="section-title">Lesson content</h2>
                <p className="mt-4 whitespace-pre-line text-slate-300">{lesson.content?.body ?? lesson.summary ?? 'Lesson content will appear here once published by the instructor.'}</p>
              </div>

              {lesson.content?.resources && lesson.content.resources.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Resources</h3>
                  <ul className="space-y-2 text-sm text-brand-100">
                    {lesson.content.resources.map((resource) => (
                      <li key={resource.url}><a href={resource.url} target="_blank" rel="noreferrer" className="hover:text-white">{resource.label}</a></li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <aside className="space-y-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                <h3 className="text-lg font-semibold text-white">Progress checkpoint</h3>
                <p className="mt-3 text-sm text-slate-300">Mark this lesson complete to update your dashboard and continue your learning path.</p>
                <div className="mt-5">
                  <LessonCompletionButton courseId={course.id} lessonId={lesson.id} completed={lesson.completed} />
                </div>
              </div>

              {nextLesson ? <Link href={`/courses/${course.id}/lessons/${nextLesson.id}`} className="primary-button w-full">Next lesson</Link> : null}
            </aside>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    return <div className="surface border border-rose-500/30 bg-rose-500/10 p-8 text-rose-100">{error instanceof Error ? error.message : 'Unable to load this lesson.'}</div>;
  }
}
