import type { CaseStudy } from '@/lib/content';

interface CaseStudySectionProps {
  studies: CaseStudy[];
}

export default function CaseStudySection({ studies }: CaseStudySectionProps) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-forge-400">Success stories</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Real learners, real outcomes</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {studies.map((study) => (
          <article key={study.id} className="surface flex flex-col gap-4 p-6">
            <div>
              <p className="text-lg font-semibold text-white">{study.learner}</p>
              <p className="text-sm text-slate-400">{study.role}{study.company ? ` · ${study.company}` : ''}</p>
            </div>
            <p className="text-sm italic text-slate-300">&ldquo;{study.quote}&rdquo;</p>
            <div className="mt-auto space-y-2">
              <p className="text-sm font-medium text-forge-100">{study.outcome}</p>
              <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                {study.metric}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
