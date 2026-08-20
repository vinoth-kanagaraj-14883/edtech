import { XP_PER_LESSON, type LevelInfo } from '@/lib/gamification';

interface LevelProgressProps {
  level: LevelInfo;
}

/**
 * XP track toward the next level. Uses the fuchsia "plasma" accent so the reward
 * layer is visually separate from navigation and course chrome.
 */
export default function LevelProgress({ level }: LevelProgressProps) {
  const remaining = Math.max(0, level.xpForNextLevel - level.xpIntoLevel);
  const lessonsToGo = Math.max(1, Math.ceil(remaining / XP_PER_LESSON));

  return (
    <div className="surface relative overflow-hidden p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-plasma opacity-20 blur-3xl"
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="orb-label">Experience</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight plasma-text">Level {level.level}</span>
            <span className="text-xs font-semibold tabular-nums text-content-subtle">
              {level.xp.toLocaleString()} XP total
            </span>
          </p>
        </div>
        <p className="text-xs font-semibold tabular-nums text-content-muted">
          {level.xpIntoLevel} / {level.xpForNextLevel} XP
        </p>
      </div>

      <div className="mt-4 xp-track">
        <div
          className="xp-fill"
          style={{ width: `${level.progressPercent}%` }}
          role="progressbar"
          aria-valuenow={level.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Level ${level.level} progress`}
        />
      </div>

      <p className="mt-3 text-xs text-content-subtle">
        {remaining.toLocaleString()} XP to level {level.level + 1} — about{' '}
        <span className="font-semibold text-content-muted">
          {lessonsToGo} more lesson{lessonsToGo === 1 ? '' : 's'}
        </span>
        .
      </p>
    </div>
  );
}
