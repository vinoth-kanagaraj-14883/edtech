import Link from 'next/link';

import ProgressBar from '@/components/ProgressBar';
import type { Course } from '@/types';

interface CourseCardProps {
  course: Course;
}

export default function CourseCard({ course }: CourseCardProps) {
  return (
    <article className="surface flex h-full flex-col overflow-hidden">
      <div className="flex h-40 items-center justify-center bg-gradient-to-br from-brand-600/20 via-slate-900 to-slate-950 text-center">
        <div className="space-y-2 px-6">
          <span className="inline-flex rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-brand-100">
            {course.level.replace('-', ' ')}
          </span>
          <h3 className="text-xl font-semibold text-white">{course.title}</h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="space-y-2">
          <p className="text-sm text-slate-300">{course.shortDescription ?? course.description}</p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            {course.category ? <span>{course.category}</span> : null}
            {course.instructor ? <span>• {course.instructor}</span> : null}
            {course.durationHours ? <span>• {course.durationHours}h</span> : null}
          </div>
        </div>

        {typeof course.progress === 'number' && course.progress > 0 ? <ProgressBar value={course.progress} label="Course progress" /> : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{course.lessons.length} lessons</span>
          <Link href={`/courses/${course.id}`} className="primary-button">
            View course
          </Link>
        </div>
      </div>
    </article>
  );
}
