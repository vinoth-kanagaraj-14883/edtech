import Link from 'next/link';

import EnrollButton from '@/components/EnrollButton';
import ProgressBar from '@/components/ProgressBar';
import { getCourse } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';

interface CourseDetailPageProps {
  params: {
    id: string;
  };
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { token } = requireServerAuth();

  try {
    const course = await getCourse(params.id, { token });

    return (
      <div className="space-y-8">
        <section className="surface space-y-6 p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-brand-100">{course.level.replace('-', ' ')}</span>
              <h1 className="text-4xl font-semibold tracking-tight text-white">{course.title}</h1>
              <p className="text-slate-300">{course.description}</p>
              <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                {course.instructor ? <span>Instructor: {course.instructor}</span> : null}
                {course.category ? <span>• {course.category}</span> : null}
                {course.durationHours ? <span>• {course.durationHours} hours</span> : null}
              </div>
            </div>
            <EnrollButton courseId={course.id} enrolled={course.enrolled} />
          </div>

          {typeof course.progress === 'number' && course.progress > 0 ? <ProgressBar value={course.progress} label="Current progress" /> : null}
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_360px]">
          <div className="surface p-8">
            <h2 className="section-title">Lessons</h2>
            <div className="mt-6 space-y-4">
              {course.lessons.length > 0 ? (
                course.lessons.map((lesson) => (
                  <Link key={lesson.id} href={`/courses/${course.id}/lessons/${lesson.id}`} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4 hover:border-brand-500/50">
                    <div>
                      <p className="text-sm font-medium text-white">{lesson.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{lesson.summary ?? 'Interactive lesson content'}</p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{lesson.durationMinutes ? `${lesson.durationMinutes} min` : `Lesson ${lesson.order}`}</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-400">No lessons published yet.</p>
              )}
            </div>
          </div>

          <aside className="surface space-y-5 p-8">
            <h2 className="section-title">Course summary</h2>
            <div className="space-y-3 text-sm text-slate-300">
              <p>{course.shortDescription ?? course.description}</p>
              <p>Lessons available: {course.lessons.length}</p>
              <p>Quizzes included: {course.quizIds?.length ?? 0}</p>
            </div>
            {course.lessons[0] ? <Link href={`/courses/${course.id}/lessons/${course.lessons[0].id}`} className="primary-button">Start first lesson</Link> : null}
          </aside>
        </section>
      </div>
    );
  } catch (error) {
    return <div className="surface border border-rose-500/30 bg-rose-500/10 p-8 text-rose-100">{error instanceof Error ? error.message : 'Unable to load the selected course.'}</div>;
  }
}
