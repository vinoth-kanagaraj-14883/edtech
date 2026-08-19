import type { CaseStudy } from '@/lib/content';

interface CaseStudySectionProps {
  studies: CaseStudy[];
}

export default function CaseStudySection({ studies }: CaseStudySectionProps) {
  return (
    <section aria-labelledby="case-studies-heading" className="relative py-16 sm:py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-mesh opacity-70" aria-hidden="true" />

      <header className="max-w-2xl">
        <p className="eyebrow">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 20V13M10 20V8M16 20v-5M22 20V4" />
          </svg>
          Success stories
        </p>
        <h2 id="case-studies-heading" className="section-title mt-3">
          Real learners, <span className="gradient-text">real outcomes</span>
        </h2>
        <p className="section-subtitle mt-3">
          Career changes, promotions, and shipped projects — here is what learners did with the platform.
        </p>
      </header>

      <div className="stagger mt-10 grid gap-6 md:grid-cols-3">
        {studies.map((study) => (
          <article key={study.id} className="surface-hover group relative flex flex-col gap-5 overflow-hidden p-6">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-gradient opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              aria-hidden="true"
            />

            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white shadow-glow"
                aria-hidden="true"
              >
                {study.learner
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)}
              </span>
              <div className="min-w-0">
                <p className="text-base font-bold tracking-tight text-content">{study.learner}</p>
                <p className="text-xs text-content-subtle">
                  {study.role}
                  {study.company ? ` · ${study.company}` : ''}
                </p>
              </div>
            </div>

            <blockquote className="flex-1 text-sm leading-relaxed text-content-muted">
              <svg
                className="mb-2 h-5 w-5 text-brand-400"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7.5 5A4.5 4.5 0 0 0 3 9.5V17a2 2 0 0 0 2 2h3.5a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H6.2A3.3 3.3 0 0 1 9.5 8.7V5h-2Zm10 0A4.5 4.5 0 0 0 13 9.5V17a2 2 0 0 0 2 2h3.5a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-2.3A3.3 3.3 0 0 1 19.5 8.7V5h-2Z" />
              </svg>
              {study.quote}
            </blockquote>

            <div className="mt-auto space-y-3 border-t border-hairline pt-4">
              <p className="flex items-start gap-2 text-sm font-semibold text-content">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-success-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m4.5 12.5 4.5 4.5L19.5 6.5" />
                </svg>
                {study.outcome}
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-xs font-bold text-success-600 ring-1 ring-inset ring-success-500/25 dark:bg-success-500/12">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3.5 17 9 11l3.5 3.5L20 7" />
                  <path d="M20 12V7h-5" />
                </svg>
                {study.metric}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
