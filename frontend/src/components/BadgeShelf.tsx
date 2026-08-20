import type { Badge } from '@/lib/gamification';

interface BadgeShelfProps {
  badges: Badge[];
}

/**
 * Achievement shelf. Locked badges stay visible (dimmed + greyscale) with their
 * progress, because a visible locked goal is what makes the next one feel worth
 * chasing — hiding them would remove the pull entirely.
 */
export default function BadgeShelf({ badges }: BadgeShelfProps) {
  const unlockedCount = badges.filter((badge) => badge.unlocked).length;

  return (
    <div className="surface p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="orb-label">Achievements</p>
          <p className="mt-1 text-sm text-content-muted">
            <span className="font-bold text-content">{unlockedCount}</span> of {badges.length} unlocked
          </p>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6 lg:grid-cols-3">
        {badges.map((badge) => (
          <li
            key={badge.id}
            className={`badge-tile ${badge.unlocked ? 'badge-unlocked' : 'badge-locked'}`}
            title={`${badge.label} — ${badge.description}`}
          >
            <span className="text-xl" aria-hidden="true">
              {badge.unlocked ? badge.icon : '🔒'}
            </span>
            <span className="text-[10.5px] font-bold leading-tight text-content">{badge.label}</span>
            {badge.progressLabel ? (
              <span className="text-[10px] tabular-nums text-content-subtle">{badge.progressLabel}</span>
            ) : null}
            <span className="sr-only">
              {badge.description}. {badge.unlocked ? 'Unlocked.' : `Locked. ${badge.progressLabel ?? ''}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
