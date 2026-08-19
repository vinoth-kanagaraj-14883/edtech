import type { ReactNode } from 'react';

/** Inline spinner for pending button states. */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Destructive/failure message block. */
export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-danger-500/25 bg-danger-50 px-3 py-2 text-sm font-medium text-danger-600 animate-fade-in dark:bg-danger-500/10"
    >
      <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="1.1" fill="currentColor" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/**
 * Full-width page-level notice (access gates, load failures). `tone` picks the
 * semantic palette; the previous markup used light-on-light text and was
 * effectively invisible.
 */
export function PageNotice({
  tone = 'danger',
  title,
  children
}: {
  tone?: 'danger' | 'warning';
  title: string;
  children?: ReactNode;
}) {
  const styles =
    tone === 'warning'
      ? 'border-warning-500/25 bg-warning-50 text-warning-600 dark:bg-warning-500/10'
      : 'border-danger-500/25 bg-danger-50 text-danger-600 dark:bg-danger-500/10';

  return (
    <div role="alert" className={`rounded-2xl border p-6 sm:p-8 ${styles}`}>
      <div className="flex items-start gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4.5M12 16h.01" />
        </svg>
        <div className="min-w-0 space-y-2">
          <p className="text-lg font-bold text-content">{title}</p>
          {children ? <div className="text-sm text-content-muted">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** Confirmation/success message block. */
export function SuccessAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-success-500/25 bg-success-50 px-3 py-2 text-sm font-medium text-success-600 animate-fade-in dark:bg-success-500/10"
    >
      <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="m8.5 12.2 2.4 2.4 4.6-4.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </div>
  );
}
