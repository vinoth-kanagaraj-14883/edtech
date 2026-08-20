'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { ApiError, createPayment, enrollInCourse, unenrollFromCourse } from '@/lib/api';
import type { Payment } from '@/types';

interface EnrollButtonProps {
  courseId: string;
  enrolled?: boolean;
  /** Course price. When > 0 the enrol flow charges via payment-service first. */
  price?: number;
}

const formatAmount = (amount: number, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ErrorAlert({ children }: { children: ReactNode }) {
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

function SuccessAlert({ children }: { children: ReactNode }) {
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

export default function EnrollButton({ courseId, enrolled, price = 0 }: EnrollButtonProps) {
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<'idle' | 'paying' | 'enrolling'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const router = useRouter();

  const isPaid = price > 0;

  /**
   * Paid courses now go through payment-service before enrolment, which is what
   * the "payment not hooked up" gap was: the service and its gateway route both
   * existed, but nothing ever called them, so paid courses enrolled for free.
   *
   * Payment failure is reported separately from enrolment failure on purpose —
   * the chaos scenarios `payment-gateway-down` and `payment-gateway-latency`
   * make the provider fail, and the learner should see "the charge failed, you
   * were not enrolled" rather than a generic error.
   */
  const handleEnroll = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setReceipt(null);

    try {
      if (isPaid) {
        setStage('paying');
        const payment = await createPayment(courseId);
        setReceipt(payment);

        // payment-service reports a successful charge as `completed`; accept the
        // common synonyms rather than matching one exact string, so a wording
        // change on the backend cannot silently turn good charges into failures.
        const ok = ['completed', 'succeeded', 'success', 'paid', 'captured'].includes(
          (payment.status ?? '').toLowerCase()
        );
        if (!ok) {
          setError(
            `Payment ${payment.status}. You have not been enrolled and nothing was charged — please try again.`
          );
          return;
        }
      }

      setStage('enrolling');
      try {
        await enrollInCourse(courseId);
      } catch (enrollError) {
        // course-service returns 409 when an enrolment for this user/course pair
        // already exists. After a successful charge that is not a failure — the
        // learner has access. Surfacing an error here would tell someone who was
        // just billed that it did not work, which is the worst possible outcome.
        if (!(enrollError instanceof ApiError && enrollError.status === 409)) {
          throw enrollError;
        }
      }

      setMessage(
        isPaid
          ? 'Payment received — you are now enrolled in this course.'
          : 'You are now enrolled in this course.'
      );
      router.refresh();
    } catch (enrollmentError) {
      const detail = enrollmentError instanceof Error ? enrollmentError.message : null;
      setError(
        stage === 'paying'
          ? detail ?? 'The payment could not be processed. You have not been enrolled.'
          : detail ?? 'Unable to enroll right now.'
      );
    } finally {
      setStage('idle');
      setLoading(false);
    }
  };

  const handleUnenroll = async () => {
    if (!window.confirm('Remove this course from your enrolled list? Your progress will be lost.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await unenrollFromCourse(courseId);
      setMessage(null);
      router.refresh();
    } catch (unenrollError) {
      setError(unenrollError instanceof Error ? unenrollError.message : 'Unable to unenroll right now.');
    } finally {
      setLoading(false);
    }
  };

  if (enrolled) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip-brand">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Enrolled
          </span>
          <button type="button" onClick={handleUnenroll} disabled={loading} className="danger-button text-xs">
            {loading ? (
              <>
                <Spinner />
                Removing…
              </>
            ) : (
              'Unenroll'
            )}
          </button>
        </div>
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isPaid ? (
        <div className="flex items-baseline justify-between gap-3 rounded-xl border border-hairline bg-muted/60 px-3.5 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-content-subtle">Total today</span>
          <span className="text-xl font-extrabold tracking-tight text-content">{formatAmount(price)}</span>
        </div>
      ) : null}

      <button type="button" onClick={handleEnroll} className="primary-button w-full" disabled={loading}>
        {loading ? (
          <>
            <Spinner />
            {stage === 'paying' ? 'Processing payment…' : 'Enrolling…'}
          </>
        ) : isPaid ? (
          `Enroll & pay ${formatAmount(price)}`
        ) : (
          'Enroll now'
        )}
      </button>

      {isPaid && !message ? (
        <p className="text-center text-[11px] text-content-subtle">
          Secure checkout — you are charged once, with no subscription.
        </p>
      ) : null}

      {message ? <SuccessAlert>{message}</SuccessAlert> : null}
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}

      {/* Receipt, shown for both success and a declined charge so the learner
          always has the provider reference to quote. */}
      {receipt ? (
        <dl className="space-y-1 rounded-xl border border-hairline bg-surface px-3.5 py-3 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-content-subtle">Charge</dt>
            <dd className="font-semibold text-content">{formatAmount(receipt.amount, receipt.currency)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-content-subtle">Status</dt>
            <dd
              className={`font-semibold capitalize ${
                ['completed', 'succeeded', 'success', 'paid', 'captured'].includes(receipt.status.toLowerCase())
                  ? 'text-success-400'
                  : 'text-danger-400'
              }`}
            >
              {receipt.status}
            </dd>
          </div>
          {receipt.providerRef ? (
            <div className="flex justify-between gap-3">
              <dt className="text-content-subtle">Reference</dt>
              <dd className="font-mono text-[10.5px] text-content-muted">{receipt.providerRef}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
