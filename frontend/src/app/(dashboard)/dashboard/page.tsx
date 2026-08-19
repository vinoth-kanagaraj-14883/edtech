import Link from 'next/link';

import CourseCard from '@/components/CourseCard';
import { getCurrentUser, getEnrolledCourses, getRecentActivity } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';

const ACTIVITY_TONE: Record<string, string> = {
  info: 'bg-brand-50 text-brand-600 ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300 dark:ring-brand-400/25',
  success: 'bg-success-50 text-success-600 ring-success-500/25 dark:bg-success-500/12 dark:text-success-500',
  warning: 'bg-warning-50 text-warning-600 ring-warning-500/25 dark:bg-warning-500/12 dark:text-warning-500',
  error: 'bg-danger-50 text-danger-600 ring-danger-500/25 dark:bg-danger-500/12 dark:text-danger-500'
};

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

  const lessonsCompleted = courses.reduce((sum, course) => sum + (course.enrollment?.completedLessons ?? 0), 0);
  const stats = [
    {
      label: 'My courses',
      value: courses.length,
      hint: courses.length === 1 ? 'active enrollment' : 'active enrollments',
      icon: <path d="M3 5.5 10 3l7 2.5-7 2.5-7-2.5Zm0 4.5 7 2.5 7-2.5M3 14l7 2.5L17 14" strokeLinecap="round" strokeLinejoin="round" />
    },
    {
      label: 'In progress',
      value: inProgressCount,
      hint: 'keep the streak going',
      icon: <path d="M10 3v7l4.5 2.5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" strokeLinecap="round" strokeLinejoin="round" />
    },
    {
      label: 'Completed',
      value: completedCount,
      hint: 'courses finished',
      icon: <path d="m5 10.5 3.5 3.5L15 6.5" strokeLinecap="round" strokeLinejoin="round" />
    },
    {
      label: 'Lessons done',
      value: lessonsCompleted,
      hint: 'across all courses',
      icon: <path d="M4 4h9l3 3v9H4V4Zm3 5h6M7 12h4" strokeLinecap="round" strokeLinejoin="round" />
    }
  ];

  return (
    <div className="space-y-12">
      <header className="page-header sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="eyebrow">Personalized dashboard</p>
          <h1 className="text-headline text-content">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="section-subtitle max-w-2xl">
            Track your enrolled courses, continue active lessons, and stay on top of quiz performance.
          </p>
        </div>
        <Link href="/courses" className="primary-button self-start whitespace-nowrap sm:self-auto">
          Browse catalog
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 10h11m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </header>

      {/* KPI tiles */}
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          Learning summary
        </h2>
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-tile">
              <div
                className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-gradient opacity-[0.09]"
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-3">
                <p className="stat-label">{stat.label}</p>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300 dark:ring-brand-400/25">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    {stat.icon}
                  </svg>
                </span>
              </div>
              <p className="stat-value mt-3">{stat.value}</p>
              <p className="mt-1 text-xs text-content-subtle">{stat.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Enrolled courses */}
      <section className="space-y-5" aria-labelledby="enrolled-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 id="enrolled-heading" className="section-title">
              Enrolled courses
            </h2>
            <p className="section-subtitle">Pick up where you left off.</p>
          </div>
          <Link href="/courses" className="secondary-button whitespace-nowrap">
            Browse all courses
          </Link>
        </div>

        {courses.length > 0 ? (
          <div className="card-grid stagger">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} currentUserId={user.id} currentUserRole={user.role} showUnenroll />
            ))}
          </div>
        ) : (
          <div className="surface flex flex-col items-center gap-4 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/12 dark:text-brand-300 dark:ring-brand-400/25">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M4 6.5 12 4l8 2.5-8 2.5-8-2.5Zm0 5.5 8 2.5 8-2.5M4 17l8 2.5 8-2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-content">No enrollments yet</h3>
              <p className="section-subtitle mx-auto max-w-sm">
                You are not enrolled in any courses yet. Explore the catalog to get started.
              </p>
            </div>
            <Link href="/courses" className="primary-button">
              Explore the catalog
            </Link>
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section className="space-y-5" aria-labelledby="activity-heading">
        <div className="space-y-1">
          <h2 id="activity-heading" className="section-title">
            Recent activity
          </h2>
          <p className="section-subtitle">Latest platform updates and progress checkpoints.</p>
        </div>

        <div className="surface overflow-hidden">
          {derivedActivity.length > 0 ? (
            <ul className="divide-y divide-hairline">
              {derivedActivity.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 p-5 transition duration-200 hover:bg-muted sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                        ACTIVITY_TONE[item.type] ?? ACTIVITY_TONE.info
                      }`}
                      aria-hidden="true"
                    >
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M10 3v7l4.5 2.5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-content">{item.title}</p>
                      <p className="mt-1 text-sm text-content-muted">{item.message}</p>
                    </div>
                  </div>
                  {item.link ? (
                    <Link href={item.link} className="link-button shrink-0 self-start sm:self-auto">
                      Open
                      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M4 10h11m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-8 text-center text-sm text-content-subtle">No recent activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
