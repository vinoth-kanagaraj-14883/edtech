import type { Interview } from '@/lib/content';

interface InterviewSectionProps {
  interviews: Interview[];
}

export default function InterviewSection({ interviews }: InterviewSectionProps) {
  return (
    <section className="py-12 sm:py-16" aria-labelledby="interviews-heading">
      <header className="max-w-2xl">
        <p className="eyebrow">Industry voices</p>
        <h2 id="interviews-heading" className="section-title mt-3">
          Interviews with practitioners
        </h2>
        <p className="section-subtitle mt-3">
          Real perspectives from people building and shipping in the field.
        </p>
      </header>

      <div className="stagger mt-10 grid gap-6 md:grid-cols-2">
        {interviews.map((interview) => (
          <article key={interview.id} className="surface-hover flex gap-5 p-6">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-lg font-bold text-white shadow-glow"
              aria-hidden="true"
            >
              {interview.name
                .split(' ')
                .map((part) => part[0])
                .join('')}
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="text-base font-bold tracking-tight text-content">{interview.name}</p>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-content-subtle">{interview.title}</p>
              <p className="pt-0.5">
                <span className="chip-brand">{interview.topic}</span>
              </p>
              <p className="pt-1 text-sm leading-relaxed text-content-muted">{interview.summary}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
