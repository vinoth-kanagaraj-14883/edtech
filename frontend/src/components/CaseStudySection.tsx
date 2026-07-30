import type { CaseStudy } from '@/lib/content';

interface CaseStudySectionProps {
  studies: CaseStudy[];
}

export default function CaseStudySection({ studies }: CaseStudySectionProps) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-forge-400">Success stories</p>
        <h2 className="mt-2 text-3xl font-semibold text-ink-900">Real learners, real outcomes</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {studies.map((study) => (
          <article key={study.id} className="surface flex flex-col gap-4 p-6">
            <div>
              <p className="text-lg font-semibold text-ink-900">{study.learner}</p>
              <p className="text-sm text-ink-500">{study.role}{study.company ? ` · ${study.company}` : ''}</p>
            </div>
            <p className="text-sm italic text-ink-700">&ldquo;{study.quote}&rdquo;</p>
            <div className="mt-auto space-y-2">
              <p className="text-sm font-medium text-forge-600">{study.outcome}</p>
              <span className="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {study.metric}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
