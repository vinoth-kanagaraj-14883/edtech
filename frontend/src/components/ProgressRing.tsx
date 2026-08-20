interface ProgressRingProps {
  /** 0-100. Values outside the range are clamped. */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Large text in the middle of the ring. Defaults to `NN%`. */
  label?: string;
  /** Small text under the label. */
  caption?: string;
  /** Gradient variant. Duplicate gradient ids across instances are harmless
   *  because each variant always resolves to the same two stops. */
  variant?: 'brand' | 'plasma' | 'ember' | 'success';
  className?: string;
}

const GRADIENTS: Record<NonNullable<ProgressRingProps['variant']>, [string, string]> = {
  brand: ['#8b5cf6', '#22d3ee'],
  plasma: ['#8b5cf6', '#d946ef'],
  ember: ['#fb923c', '#f97316'],
  success: ['#34d399', '#22d3ee']
};

/**
 * Accent progress ring used for course/lesson completion. Rendered as inline SVG
 * (no chart library) so it stays a server component and adds zero JS.
 */
export default function ProgressRing({
  value,
  size = 96,
  strokeWidth = 8,
  label,
  caption,
  variant = 'brand',
  className = ''
}: ProgressRingProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);
  const [from, to] = GRADIENTS[variant];
  const gradientId = `ring-${variant}`;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(pct)}% complete`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-hairline"
        />
        {/* Value */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold tabular-nums tracking-tight text-content">
          {label ?? `${Math.round(pct)}%`}
        </span>
        {caption ? (
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-content-subtle">
            {caption}
          </span>
        ) : null}
      </div>
    </div>
  );
}
