import Link from 'next/link';

import CourseCard from '@/components/CourseCard';
import { getCurrentUser, getEnrolledCourses, getRecentActivity } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';

export default async function DashboardPage() {
  const { token, user: fallbackUser } = requireServerAuth();
  const [userResult, courseResult, activityResult] = await Promise.allSettled([
    getCurrentUser({ token }),
    getEnrolledCourses({ token }),
    getRecentActivity({ token })
  ]);

  const user = userResult.status === 'fulfilled' ? userResult.value : fallbackUser;
  const courses = courseResult.status === 'fulfilled' ? courseResult.value : [];
  const activity = activityResult.status === 'fulfilled' ? activityResult.value : [];
  const completedCount = courses.filter((course) => (course.progress ?? 0) >= 100).length;
  const inProgressCount = courses.filter((course) => (course.progress ?? 0) > 0 && (course.progress ?? 0) < 100).length;
  const derivedActivity = activity.length
    ? activity
    : courses.slice(0, 3).map((course) => ({
        id: course.id,
        title: `Continue ${course.title}`,
        message: `${course.enrollment?.completedLessons ?? 0} of ${course.lessons.length} lessons completed.`,
        type: 'info' as const,
        createdAt: new Date().toISOString(),
        link: `/courses/${course.id}`
      }));

  return (
    <div className="space-y-10">
      <section className="surface flex flex-col gap-8 p-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-100">Personalized dashboard</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="mt-4 max-w-2xl text-slate-300">Track your enrolled courses, continue active lessons, and stay on top of quiz performance.</p>
        </div>
        <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
          {[
            { label: 'My courses', value: courses.length },
            { label: 'Completed', value: completedCount },
            { label: 'In progress', value: inProgressCount }
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="section-title">Enrolled courses</h2>
            <p className="section-subtitle">Pick up where you left off.</p>
          </div>
          <Link href="/courses" className="secondary-button">Browse all courses</Link>
        </div>

        {courses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => <CourseCard key={course.id} course={course} />)}
          </div>
        ) : (
          <div className="surface p-8 text-sm text-slate-300">You are not enrolled in any courses yet. Explore the catalog to get started.</div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="section-title">Recent activity</h2>
          <p className="section-subtitle">Latest platform updates and progress checkpoints.</p>
        </div>

        <div className="surface divide-y divide-slate-800 overflow-hidden">
          {derivedActivity.length > 0 ? (
            derivedActivity.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 p-6 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.message}</p>
                </div>
                {item.link ? <Link href={item.link} className="text-sm font-medium text-brand-100 hover:text-white">Open →</Link> : null}
              </div>
            ))
          ) : (
            <div className="p-6 text-sm text-slate-400">No recent activity yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
