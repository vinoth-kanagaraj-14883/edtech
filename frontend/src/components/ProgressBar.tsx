import clsx from 'clsx';

interface ProgressBarProps {
  value: number;
  label?: string;
  className?: string;
}

export default function ProgressBar({ value, label, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
        <span>{label ?? 'Progress'}</span>
        <span>{Math.round(clamped)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-100 transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
