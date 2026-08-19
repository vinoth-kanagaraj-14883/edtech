import clsx from 'clsx';

interface ProgressBarProps {
  value: number;
  label?: string;
  className?: string;
}

export default function ProgressBar({ value, label, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const complete = clamped >= 100;

  return (
    <div className={clsx('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span className="text-content-subtle">{label ?? 'Progress'}</span>
        <span className={complete ? 'text-success-600' : 'text-brand-600'}>
          {complete ? 'Complete' : `${Math.round(clamped)}%`}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-hairline"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500 ease-smooth',
            complete ? 'bg-success-500' : 'bg-gradient-to-r from-brand-500 to-accent-500'
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
