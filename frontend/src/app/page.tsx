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
  { label: 'New content weekly', value: 'Always fresh' }
];

const CATEGORIES = [
  { label: 'Cloud Computing', icon: '☁️', tint: 'from-forge-500 to-forge-700' },
  { label: 'Programming', icon: '💻', tint: 'from-brand-500 to-brand-700' },
  { label: 'Data & AI', icon: '🤖', tint: 'from-fuchsia-500 to-brand-600' },
  { label: 'DevOps', icon: '⚙️', tint: 'from-sky-500 to-forge-600' },
  { label: 'Languages', icon: '🗣️', tint: 'from-rose-500 to-brand-500' },
  { label: 'Security', icon: '🔐', tint: 'from-emerald-500 to-forge-600' },
  { label: 'Web Development', icon: '🌐', tint: 'from-orange-500 to-brand-600' },
  { label: 'Certifications', icon: '🎓', tint: 'from-violet-500 to-forge-500' }
];

// "Trusted by" company wordmarks (text-based so we don't ship external logos).
const TRUSTED_BY = ['Volkswagen', 'Samsung', 'Cisco', 'Vimeo', 'P&G', 'Citi', 'Ericsson', 'Nasdaq'];

const TESTIMONIALS = [
  {
    quote:
      'The AI track explained everything from fundamentals to real application. I now use these tools responsibly at work every day.',
    name: 'Cris M.',
    role: 'AI Essentials graduate'
  },
  {
    quote:
      'EduForge was a game-changer as I brought my product to life. The hands-on quizzes made the concepts stick.',
    name: 'Alvin L.',
    role: 'Technical Co-Founder & CTO'
  },
  {
    quote:
      'I learned exactly what I needed for the real world. It helped me sell myself and land a new role.',
    name: 'William W.',
    role: 'Partner Account Manager, Cloud'
  }
];

const CERTIFICATIONS = [
  { label: 'CompTIA', desc: 'Cloud, Networking, Cybersecurity', tint: 'from-forge-500 to-forge-700' },
  { label: 'AWS', desc: 'Cloud, AI, Coding, Networking', tint: 'from-orange-500 to-brand-600' },
  { label: 'Azure', desc: 'Cloud, Data, DevOps, AI', tint: 'from-sky-500 to-forge-600' },
  { label: 'PMI', desc: 'Project & Program Management', tint: 'from-violet-500 to-forge-500' }
];

const POPULAR_SKILLS = [
  'Python',
  'Machine Learning',
  'AWS',
  'Kubernetes',
  'React',
  'SQL',
  'Terraform',
  'Docker',
  'TypeScript',
  'Cybersecurity',
  'Data Analysis',
  'Prompt Engineering'
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
    <div className="space-y-4">
      {/* Hero */}
      <section className="relative isolate overflow-hidden rounded-4xl border border-hairline bg-surface px-6 py-14 sm:px-12 sm:py-20">
        {/* Decorative gradient mesh */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-mesh" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"
        />

        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="animate-fade-up space-y-7">
            <p className="eyebrow">
              <span className="flex h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
              Learn. Build. Evolve.
            </p>

            <h1 className="text-display-lg text-content">
              Learn the skills that <span className="gradient-text">move your career</span> forward
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-content-muted">
              EduForge helps you build in-demand skills fast with expert-led courses, hands-on lessons and hundreds of
              practice quizzes — then proves it with a shareable certificate.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/register" className="primary-button px-6 py-3 text-base">
                Start learning free
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <Link href="/courses" className="secondary-button px-6 py-3 text-base">
                Browse courses
              </Link>
            </div>

            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-hairline pt-7 sm:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block text-2xl font-extrabold tracking-tight text-content">{stat.value}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-content-subtle">
                      {stat.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Featured track card */}
          <div className="relative hidden lg:block">
            <div className="animate-float relative overflow-hidden rounded-3xl bg-brand-gradient p-8 shadow-glow-lg">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-mesh opacity-60" />
              <div className="relative flex flex-col gap-4 text-white">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur">
                  Featured track
                </span>
                <p className="text-3xl font-extrabold leading-tight tracking-tight">Cloud &amp; AI Career Path</p>
                <p className="text-sm leading-relaxed text-white/90">
                  A guided path from fundamentals to certification-ready, with quizzes at every step.
                </p>
                <ul className="mt-1 space-y-2 text-sm text-white/90">
                  {['12 hands-on modules', 'Practice quizzes per module', 'Certificate on completion'].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m20 6-11 11-5-5" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="mt-3 inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/95"
                >
                  Explore the path
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="py-12" aria-label="Trusted by">
        <p className="text-center text-sm font-medium text-content-subtle">
          Trusted by over 17,000 companies and millions of learners around the world
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {TRUSTED_BY.map((company) => (
            <span
              key={company}
              className="text-lg font-extrabold tracking-tight text-ink-300 transition duration-200 hover:text-content-muted dark:text-ink-600"
            >
              {company}
            </span>
          ))}
        </div>
      </section>

      {/* Browse categories */}
      <section className="py-12 sm:py-16" aria-labelledby="categories-heading">
        <header className="max-w-2xl">
          <p className="eyebrow">Explore</p>
          <h2 id="categories-heading" className="section-title mt-3">
            Browse top categories
          </h2>
          <p className="section-subtitle mt-3">Pick a subject and start learning today.</p>
        </header>
        <div className="stagger mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((category) => (
            <Link
              key={category.label}
              href={{ pathname: '/courses', query: { search: category.label } }}
              className="surface-hover group flex items-center gap-3 p-4"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${category.tint} text-xl shadow-sm transition duration-300 group-hover:scale-110`}
                aria-hidden="true"
              >
                {category.icon}
              </span>
              <span className="text-sm font-bold text-content transition group-hover:text-brand-600">
                {category.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular skills */}
      <section className="py-12 sm:py-16" aria-labelledby="skills-heading">
        <header className="max-w-2xl">
          <p className="eyebrow">Trending</p>
          <h2 id="skills-heading" className="section-title mt-3">
            Popular skills
          </h2>
          <p className="section-subtitle mt-3">Topics learners are picking up right now.</p>
        </header>
        <div className="mt-8 flex flex-wrap gap-2.5">
          {POPULAR_SKILLS.map((skill) => (
            <Link
              key={skill}
              href={{ pathname: '/courses', query: { search: skill } }}
              className="rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-content-muted shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
            >
              {skill}
            </Link>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 sm:py-16" aria-labelledby="testimonials-heading">
        <header className="max-w-2xl">
          <p className="eyebrow">Learner stories</p>
          <h2 id="testimonials-heading" className="section-title mt-3">
            Join others transforming their lives through learning
          </h2>
        </header>
        <div className="stagger mt-10 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <figure key={testimonial.name} className="surface-hover flex flex-col gap-5 p-6">
              <svg
                className="h-8 w-8 text-brand-400"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M9.5 5C6.5 6.8 5 9.6 5 13.4V19h5.4v-5.6H7.9c0-2.3.8-4 2.4-5.2L9.5 5Zm8.6 0c-3 1.8-4.5 4.6-4.5 8.4V19H19v-5.6h-2.5c0-2.3.8-4 2.4-5.2L18.1 5Z" />
              </svg>
              <blockquote className="flex-1 text-sm leading-relaxed text-content-muted">
                {testimonial.quote}
              </blockquote>
              <figcaption className="flex items-center gap-3 border-t border-hairline pt-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white"
                  aria-hidden="true"
                >
                  {testimonial.name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-content">{testimonial.name}</p>
                  <p className="truncate text-xs text-content-subtle">{testimonial.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Certifications */}
      <section className="py-12 sm:py-16" aria-labelledby="certs-heading">
        <header className="max-w-2xl">
          <p className="eyebrow">Credentials</p>
          <h2 id="certs-heading" className="section-title mt-3">
            Get certified and get ahead in your career
          </h2>
          <p className="section-subtitle mt-3">
            Prep for certifications with comprehensive courses and practice tests.
          </p>
        </header>
        <div className="stagger mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CERTIFICATIONS.map((cert) => (
            <Link
              key={cert.label}
              href={{ pathname: '/courses', query: { search: cert.label } }}
              className="surface-hover group flex flex-col gap-4 p-6"
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${cert.tint} text-lg font-black text-white shadow-sm transition duration-300 group-hover:scale-105`}
                aria-hidden="true"
              >
                {cert.label.slice(0, 2)}
              </span>
              <div>
                <p className="text-lg font-bold tracking-tight text-content transition group-hover:text-brand-600">
                  {cert.label}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-content-subtle">{cert.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Sample quizzes */}
      {previewQuizzes.length > 0 ? (
        <section className="py-12 sm:py-16" aria-labelledby="quiz-preview-heading">
          <header className="max-w-2xl">
            <p className="eyebrow">Try it now</p>
            <h2 id="quiz-preview-heading" className="section-title mt-3">
              Try a sample quiz
            </h2>
            <p className="section-subtitle mt-3">
              A taste of the 100+ quizzes waiting inside. Sign up to track scores and pick up where you left off.
            </p>
          </header>

          <div className="stagger mt-10 grid gap-6 md:grid-cols-2">
            {previewQuizzes.map((quiz) => (
              <PublicQuizPreview key={quiz.id} quiz={quiz} />
            ))}
          </div>
        </section>
      ) : null}

      <CaseStudySection studies={caseStudies} />

      <BlogSection posts={blogPosts} />

      <InterviewSection interviews={interviews} />

      {/* Final CTA */}
      <section className="relative isolate my-12 overflow-hidden rounded-4xl bg-brand-gradient px-6 py-16 text-center sm:px-14 sm:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-mesh opacity-70" />
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
          <Image
            src="/logo.png"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-2xl object-contain shadow-lifted"
          />
          <h2 className="text-display text-white">Join thousands of learners forging their next skill</h2>
          <p className="max-w-lg text-base leading-relaxed text-white/90">
            Create a free account and get instant access to the full catalog of courses, quizzes and certificates.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-bold text-brand-700 shadow-lifted transition duration-200 hover:-translate-y-0.5 hover:bg-white/95"
            >
              Create your free account
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link
              href="/courses"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:bg-white/20"
            >
              Browse the catalog
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
