import Link from 'next/link';

import BadgeShelf from '@/components/BadgeShelf';
import ContinueLearningHero from '@/components/ContinueLearningHero';
import CertificateShelf from '@/components/CertificateShelf';
import CourseCard from '@/components/CourseCard';
import LevelProgress from '@/components/LevelProgress';
import MetricOrbs from '@/components/MetricOrbs';
import { getCurrentUser, getEnrolledCoursesDetailed, getMyCertificates, getRecentActivity } from '@/lib/api';
import { buildLearnerStats } from '@/lib/gamification';
import { requireServerAuth } from '@/lib/server-auth';

const ACTIVITY_TONE: Record<string, string> = {
  info: 'bg-brand-500/10 text-brand-300 ring-brand-400/30',
  success: 'bg-success-500/10 text-success-400 ring-success-500/30',
  warning: 'bg-warning-500/10 text-warning-400 ring-warning-500/30',
  error: 'bg-danger-500/10 text-danger-400 ring-danger-500/30'
};

export default async function DashboardPage() {
  const { token, user: fallbackUser } = requireServerAuth();
  const [userResult, courseResult, activityResult, certificateResult] = await Promise.allSettled([
    getCurrentUser({ token }),
    getEnrolledCoursesDetailed({ token }),
    getRecentActivity({ token }),
    getMyCertificates({ token })
  ]);

  const user = userResult.status === 'fulfilled' ? userResult.value : fallbackUser;
  const courses = courseResult.status === 'fulfilled' ? courseResult.value : [];
  const activity = activityResult.status === 'fulfilled' ? activityResult.value : [];
  const certificates = certificateResult.status === 'fulfilled' ? certificateResult.value : [];

  // Everything below is derived from real enrollment/lesson data — see
  // lib/gamification.ts. Nothing is fabricated when the data is missing.
  const stats = buildLearnerStats(courses);
  const firstName = user.name?.split(' ')[0] ?? 'there';

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

  // Surface in-progress courses first — a finished course does not need a nudge.
  const sortedCourses = courses.slice().sort((a, b) => {
    const aDone = (a.progress ?? 0) >= 100 ? 1 : 0;
    const bDone = (b.progress ?? 0) >= 100 ? 1 : 0;
    if (aDone !== bDone) {
      return aDone - bDone;
    }
    return (b.progress ?? 0) - (a.progress ?? 0);
  });

  return (
    <div className="space-y-10">
      {/* ── Focal: one obvious next action ─────────────────────────────── */}
      {stats.continueTarget ? (
        <ContinueLearningHero target={stats.continueTarget} firstName={firstName} />
      ) : (
        <section className="aurora-panel px-6 py-12 text-center sm:px-10 sm:py-16">
          <p className="eyebrow justify-center">
            <span className="flex h-1.5 w-1.5 animate-glow-pulse rounded-full bg-brand-400" aria-hidden="true" />
            Let&apos;s begin
          </p>
          <h1 className="mt-4 text-display text-content">
            Welcome, {firstName}. <span className="gradient-text">Pick your first skill.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-content-muted">
            Enroll in a course to start earning XP, building a streak, and unlocking achievements as you go.
          </p>
          <Link href="/courses" className="cta-button mx-auto mt-8">
            Explore the catalog
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </section>
      )}

      {/* ── State of play ──────────────────────────────────────────────── */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">
          Your learning stats
        </h2>
        <MetricOrbs stats={stats} />
      </section>

      {/* ── Courses + reward rail ──────────────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="space-y-5" aria-labelledby="enrolled-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 id="enrolled-heading" className="section-title">
                Keep going
              </h2>
              <p className="section-subtitle">
                {stats.coursesInProgress > 0
                  ? `${stats.coursesInProgress} course${stats.coursesInProgress === 1 ? '' : 's'} in progress.`
                  : 'Your enrolled courses.'}
              </p>
            </div>
            <Link href="/courses" className="secondary-button whitespace-nowrap">
              Browse all
            </Link>
          </div>

          {sortedCourses.length > 0 ? (
            <div className="stagger grid gap-5 sm:grid-cols-2">
              {sortedCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  currentUserId={user.id}
                  currentUserRole={user.role}
                  showUnenroll
                />
              ))}
            </div>
          ) : (
            <div className="surface flex flex-col items-center gap-4 px-6 py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-300 ring-1 ring-inset ring-brand-400/30">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M4 6.5 12 4l8 2.5-8 2.5-8-2.5Zm0 5.5 8 2.5 8-2.5M4 17l8 2.5 8-2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-content">No enrollments yet</h3>
                <p className="section-subtitle mx-auto max-w-sm">
                  Explore the catalog to get started — your first lesson is worth 50 XP.
                </p>
              </div>
              <Link href="/courses" className="primary-button">
                Explore the catalog
              </Link>
            </div>
          )}
        </section>

        {/* Reward rail */}
        <aside className="space-y-5 lg:sticky lg:top-24" aria-label="Progress and achievements">
          <LevelProgress level={stats.level} />
          <CertificateShelf certificates={certificates} />
          <BadgeShelf badges={stats.badges} />
        </aside>
      </div>

      {/* ── Activity ───────────────────────────────────────────────────── */}
      <section className="space-y-5" aria-labelledby="activity-heading">
        <div className="space-y-1">
          <h2 id="activity-heading" className="section-title">
            Recent activity
          </h2>
          <p className="section-subtitle">Your latest progress checkpoints.</p>
        </div>

        <div className="surface overflow-hidden">
          {derivedActivity.length > 0 ? (
            <ul className="divide-y divide-hairline">
              {derivedActivity.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 p-5 transition duration-200 hover:bg-muted sm:flex-row sm:items-center sm:justify-between sm:gap-6"
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
