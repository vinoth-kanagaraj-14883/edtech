import type { LearnerStats } from '@/lib/gamification';

interface MetricOrbsProps {
  stats: LearnerStats;
}

/**
 * The four "state of play" metrics: streak, today's goal, lessons banked, level.
 *
 * Each orb gets its own accent aura so they read as distinct signals rather than
 * the interchangeable KPI cards the dashboard used to open with.
 *
 * Streak and daily goal depend on per-lesson `completedAt` timestamps. When the
 * API returns courses without them we render an em-dash and a short hint instead
 * of a fabricated number.
 */
export default function MetricOrbs({ stats }: MetricOrbsProps) {
  const { streak, dailyGoal, lessonsCompleted, level } = stats;

  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {/* Streak */}
      <div className="orb">
        <span className="orb-aura bg-ember-500/40" aria-hidden="true" />
        <span className="text-2xl" aria-hidden="true">
          🔥
        </span>
        {streak.hasTimestamps ? (
          <>
            <span className="orb-value">{streak.current}</span>
            <span className="orb-label">day streak</span>
            {streak.longest > streak.current ? (
              <span className="text-[10px] text-content-subtle">best {streak.longest}</span>
            ) : streak.activeToday ? (
              <span className="text-[10px] font-semibold text-success-400">banked today</span>
            ) : (
              <span className="text-[10px] text-content-subtle">study today to keep it</span>
            )}
          </>
        ) : (
          <>
            <span className="orb-value text-content-subtle">—</span>
            <span className="orb-label">day streak</span>
            <span className="text-[10px] text-content-subtle">needs lesson history</span>
          </>
        )}
      </div>

      {/* Today's goal */}
      <div className="orb">
        <span className="orb-aura bg-accent-400/30" aria-hidden="true" />
        <span className="text-2xl" aria-hidden="true">
          🎯
        </span>
        <span className="orb-value">
          {dailyGoal.completedToday}
          <span className="text-base font-bold text-content-subtle">/{dailyGoal.goal}</span>
        </span>
        <span className="orb-label">today&apos;s goal</span>
        <div className="mt-0.5 flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: dailyGoal.goal }).map((_, index) => (
            <span
              key={index}
              className={`h-1.5 w-1.5 rounded-full transition ${
                index < dailyGoal.completedToday ? 'bg-accent-400 shadow-glow-cyan' : 'bg-hairline'
              }`}
            />
          ))}
        </div>
        <span className="sr-only">
          {dailyGoal.completedToday} of {dailyGoal.goal} lessons completed today
        </span>
      </div>

      {/* Lessons completed */}
      <div className="orb">
        <span className="orb-aura bg-success-400/30" aria-hidden="true" />
        <span className="text-2xl" aria-hidden="true">
          ✅
        </span>
        <span className="orb-value">{lessonsCompleted}</span>
        <span className="orb-label">lessons done</span>
        <span className="text-[10px] text-content-subtle">
          {stats.coursesCompleted} course{stats.coursesCompleted === 1 ? '' : 's'} finished
        </span>
      </div>

      {/* Level */}
      <div className="orb">
        <span className="orb-aura bg-plasma-500/40" aria-hidden="true" />
        <span className="text-2xl" aria-hidden="true">
          💎
        </span>
        <span className="orb-value plasma-text">{level.level}</span>
        <span className="orb-label">level</span>
        <span className="text-[10px] tabular-nums text-content-subtle">
          {level.xp.toLocaleString()} XP
        </span>
      </div>
    </div>
  );
}
