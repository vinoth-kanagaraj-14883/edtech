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
    <div className="space-y-16">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-ink-300/60 bg-hero-fade">
        <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="EduForge" width={72} height={72} className="h-16 w-16 object-contain sm:h-20 sm:w-20" priority />
              <div>
                <p className="text-2xl font-extrabold text-ink-900">
                  Edu<span className="text-brand-500">Forge</span>
                </p>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-600">Learn. Build. Evolve.</p>
              </div>
            </div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-5xl">
              Learn <span className="italic text-brand-600">essential</span> career and{' '}
              <span className="italic text-forge-500">life</span> skills
            </h1>
            <p className="max-w-xl text-lg text-ink-700">
              EduForge helps you build in-demand skills fast and advance your career in a changing job market —
              with expert-led courses and hundreds of practice quizzes.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/register" className="primary-button">
                Start learning free
              </Link>
              <Link href="/courses" className="secondary-button">
                Browse courses
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <p className="text-xl font-extrabold text-ink-900">{stat.value}</p>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative hidden aspect-[4/3] w-full overflow-hidden rounded-xl bg-forge-gradient lg:block">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center text-white">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/80">Featured track</p>
              <p className="text-3xl font-extrabold leading-tight">Cloud &amp; AI Career Path</p>
              <p className="max-w-sm text-white/90">
                A guided path from fundamentals to certification-ready, with quizzes at every step.
              </p>
              <Link href="/register" className="mt-2 inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-bold text-brand-600 hover:bg-white/90">
                Explore the path
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="space-y-6 border-y border-ink-300/60 py-8">
        <p className="text-center text-sm font-semibold text-ink-500">
          Trusted by over 17,000 companies and millions of learners around the world
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {TRUSTED_BY.map((company) => (
            <span key={company} className="text-lg font-extrabold text-ink-300 grayscale transition hover:text-ink-500">
              {company}
            </span>
          ))}
        </div>
      </section>

      {/* Browse categories */}
      <section className="space-y-6">
        <div>
          <h2 className="section-title">Browse top categories</h2>
          <p className="section-subtitle mt-1">Pick a subject and start learning today.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((category) => (
            <Link
              key={category.label}
              href={{ pathname: '/courses', query: { search: category.label } }}
              className="group flex items-center gap-3 rounded-lg border border-ink-300/60 bg-white p-4 shadow-card transition hover:shadow-card-hover"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${category.tint} text-xl`}
              >
                {category.icon}
              </span>
              <span className="text-sm font-bold text-ink-900 group-hover:text-brand-600">{category.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular skills */}
      <section className="space-y-6">
        <div>
          <h2 className="section-title">Popular skills</h2>
          <p className="section-subtitle mt-1">Trending topics learners are picking up right now.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {POPULAR_SKILLS.map((skill) => (
            <Link
              key={skill}
              href={{ pathname: '/courses', query: { search: skill } }}
              className="rounded-full border border-ink-900/80 bg-white px-4 py-2 text-sm font-bold text-ink-900 transition hover:bg-ink-900 hover:text-white"
            >
              {skill}
            </Link>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="space-y-6">
        <h2 className="section-title">Join others transforming their lives through learning</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <figure key={testimonial.name} className="surface flex flex-col gap-4 p-6">
              <span className="text-4xl font-black leading-none text-brand-500">&ldquo;</span>
              <blockquote className="flex-1 text-sm text-ink-800">{testimonial.quote}</blockquote>
              <figcaption>
                <p className="text-sm font-bold text-ink-900">{testimonial.name}</p>
                <p className="text-xs text-ink-500">{testimonial.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Certifications */}
      <section className="space-y-6">
        <div>
          <h2 className="section-title">Get certified and get ahead in your career</h2>
          <p className="section-subtitle mt-1">
            Prep for certifications with comprehensive courses and practice tests.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CERTIFICATIONS.map((cert) => (
            <Link
              key={cert.label}
              href={{ pathname: '/courses', query: { search: cert.label } }}
              className="group flex flex-col gap-4 rounded-lg border border-ink-300/60 bg-white p-6 shadow-card transition hover:shadow-card-hover"
            >
              <span
                className={`flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br ${cert.tint} text-xl font-black text-white`}
              >
                {cert.label.slice(0, 2)}
              </span>
              <div>
                <p className="text-lg font-bold text-ink-900 group-hover:text-brand-600">{cert.label}</p>
                <p className="mt-1 text-sm text-ink-500">{cert.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Sample quizzes */}
      {previewQuizzes.length > 0 ? (
        <section className="space-y-6">
          <div>
            <h2 className="section-title">Try a sample quiz</h2>
            <p className="section-subtitle mt-1">
              A taste of the 100+ quizzes waiting inside. Sign up to track scores and pick up where you left off.
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

      {/* Final CTA */}
      <section className="flex flex-col items-center gap-4 rounded-2xl bg-ink-900 p-10 text-center sm:p-14">
        <div className="flex items-center justify-center gap-3">
          <Image src="/logo.png" alt="EduForge" width={56} height={56} className="h-14 w-14 object-contain" />
        </div>
        <h2 className="max-w-xl text-3xl font-extrabold text-white">Join thousands of learners forging their next skill</h2>
        <p className="max-w-lg text-ink-300">
          Create a free account and get instant access to the full catalog of courses and quizzes.
        </p>
        <Link href="/register" className="primary-button mt-2">
          Create your free account
        </Link>
      </section>
    </div>
  );
}
