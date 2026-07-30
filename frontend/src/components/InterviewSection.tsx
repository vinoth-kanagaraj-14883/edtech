import type { Interview } from '@/lib/content';

interface InterviewSectionProps {
  interviews: Interview[];
}

export default function InterviewSection({ interviews }: InterviewSectionProps) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-forge-400">Industry voices</p>
        <h2 className="mt-2 text-3xl font-semibold text-ink-900">Interviews with practitioners</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {interviews.map((interview) => (
          <article key={interview.id} className="surface flex gap-5 p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-forge-gradient text-lg font-semibold text-white">
              {interview.name
                .split(' ')
                .map((part) => part[0])
                .join('')}
            </div>
            <div className="space-y-2">
              <p className="text-base font-semibold text-ink-900">{interview.name}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-ink-500">{interview.title}</p>
              <p className="text-sm font-medium text-forge-600">{interview.topic}</p>
              <p className="text-sm text-ink-700">{interview.summary}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
