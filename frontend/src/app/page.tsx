import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import BlogSection from '@/components/BlogSection';
import CaseStudySection from '@/components/CaseStudySection';
import InterviewSection from '@/components/InterviewSection';
import PublicQuizPreview from '@/components/PublicQuizPreview';
import { getPublicQuizzes } from '@/lib/api';
import { BLOG_POSTS, CASE_STUDIES, INTERVIEWS, pickRotating } from '@/lib/content';
import { getServerUser } from '@/lib/server-auth';

const STATS = [
  { label: 'Practice quizzes', value: '100+' },
  { label: 'Courses & tracks', value: '30+' },
  { label: 'Cloud platforms covered', value: '3' },
  { label: 'Learner-authored courses', value: 'Growing weekly' }
];

export default async function HomePage() {
  const user = getServerUser();

  if (user) {
    redirect('/dashboard');
  }

  const previewQuizzes = await getPublicQuizzes(2).catch(() => []);

  // Rotates a different subset of blog/case-study/interview content in
  // every day, without requiring a backend. See lib/content.ts for the
  // rotation logic and the README for how to replace this with a real CMS.
  const blogPosts = pickRotating(BLOG_POSTS, 3, 1);
  const caseStudies = pickRotating(CASE_STUDIES, 3, 3);
  const interviews = pickRotating(INTERVIEWS, 2, 2);

  return (
    <div className="space-y-20">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-10 sm:p-14">
        <div className="pointer-events-none absolute inset-0 bg-forge-gradient opacity-10" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-forge-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />

        <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-6 text-left">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="EduForge" width={48} height={48} className="h-12 w-12 object-contain" priority />
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-forge-100">Learn. Build. Evolve.</p>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Learn languages, cloud, and AI — one quiz at a time.
            </h1>
            <p className="text-lg text-slate-300">
              Explore courses, sharpen your skills with hundreds of practice quizzes, and track your progress
              across every subject. Try a couple of sample questions below, then create a free account to unlock
              the full catalog.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/register" className="primary-button">
                Create your free account
              </Link>
              <Link href="/login" className="secondary-button">
                I already have an account
              </Link>
            </div>
          </div>

          <div className="grid w-full max-w-md grid-cols-2 gap-4 lg:w-auto">
            {STATS.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-left backdrop-blur">
                <p className="text-2xl font-semibold text-white">{stat.value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {previewQuizzes.length > 0 ? (
        <section className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-forge-400">Try it out</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Sample quizzes</h2>
            <p className="mt-2 max-w-2xl text-slate-300">
              These are just a taste — sign up to access 100+ quizzes across dozens of subjects, track your
              scores, and pick up where you left off.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {previewQuizzes.map((quiz) => (
              <PublicQuizPreview key={quiz.id} quiz={quiz} />
            ))}
          </div>
        </section>
      ) : null}

      <CaseStudySection studies={caseStudies} />

      <BlogSection posts={blogPosts} />

      <InterviewSection interviews={interviews} />

      <section className="surface flex flex-col items-center gap-4 p-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-forge-400">Ready when you are</p>
        <h2 className="max-w-xl text-3xl font-semibold text-white">Join thousands of learners forging their next skill</h2>
        <Link href="/register" className="primary-button">
          Create your free account
        </Link>
      </section>
    </div>
  );
}
