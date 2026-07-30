interface StarRatingProps {
  /** Rating value on a 0–5 scale. */
  value: number;
  /** Optional number of ratings to show alongside, e.g. "(1,204)". */
  count?: number;
  /** Render size. */
  size?: 'sm' | 'md';
  /** Use light text colors when rendered on a dark background. */
  onDark?: boolean;
  className?: string;
}

// A single 5-point star row that supports fractional fills via a clipped
// overlay — matching the half-star look used on Udemy/Coursera cards.
export default function StarRating({ value, count, size = 'sm', onDark = false, className }: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const percent = (clamped / 5) * 100;
  const starPx = size === 'md' ? 18 : 14;

  const Stars = ({ filled }: { filled: boolean }) => (
    <div className="flex" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width={starPx}
          height={starPx}
          viewBox="0 0 20 20"
          className={filled ? 'text-star' : onDark ? 'text-ink-500' : 'text-ink-300'}
          fill="currentColor"
        >
          <path d="M10 15.27 16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z" />
        </svg>
      ))}
    </div>
  );

  const textSize = size === 'md' ? 'text-sm' : 'text-xs';
  const valueColor = onDark ? 'text-star' : 'text-amber-800';
  const countColor = onDark ? 'text-ink-300' : 'text-ink-500';

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <span className={`font-bold ${valueColor} ${textSize}`}>{clamped.toFixed(1)}</span>
      <div className="relative inline-block" role="img" aria-label={`Rated ${clamped.toFixed(1)} out of 5`}>
        <Stars filled={false} />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${percent}%` }}>
          <Stars filled />
        </div>
      </div>
      {typeof count === 'number' ? (
        <span className={`${countColor} ${textSize}`}>({count.toLocaleString()})</span>
      ) : null}
    </div>
  );
}
