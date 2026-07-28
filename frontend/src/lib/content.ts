// Static content pools for the public landing page's "Blog", "Case Studies",
// and "Interviews" sections. In a real production setup this would be
// fetched from a CMS/backend instead of hardcoded here — see the README
// section "Periodic content strategy" for recommended approaches.
//
// For now, content "rotates periodically" using a deterministic pick based
// on the current day (see `pickRotating` below), so the homepage shows a
// different subset of items each day without needing any backend changes,
// while still being consistent for all visitors on the same day (and across
// server/client renders).

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  readMinutes: number;
  publishedAt: string;
}

export interface CaseStudy {
  id: string;
  learner: string;
  role: string;
  company?: string;
  outcome: string;
  quote: string;
  metric: string;
}

export interface Interview {
  id: string;
  name: string;
  title: string;
  topic: string;
  summary: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    id: 'blog-1',
    title: 'From Zero to First Deploy: A Beginner\u2019s Roadmap',
    excerpt: 'A practical, no-fluff path through fundamentals, your first project, and shipping it to the world.',
    category: 'Getting Started',
    author: 'EduForge Team',
    readMinutes: 6,
    publishedAt: '2026-07-01'
  },
  {
    id: 'blog-2',
    title: 'Why Spaced-Repetition Quizzes Beat Passive Video Watching',
    excerpt: 'The science behind active recall, and how our quiz engine is designed around it.',
    category: 'Learning Science',
    author: 'Dr. Amara Okafor',
    readMinutes: 5,
    publishedAt: '2026-07-08'
  },
  {
    id: 'blog-3',
    title: 'Cloud Certifications in 2026: AWS vs Azure vs GCP',
    excerpt: 'A side-by-side comparison to help you choose the right cloud path for your career goals.',
    category: 'Cloud',
    author: 'Priya Nair',
    readMinutes: 8,
    publishedAt: '2026-07-14'
  },
  {
    id: 'blog-4',
    title: 'Building Your First Neural Network in an Afternoon',
    excerpt: 'A hands-on walkthrough of training a simple classifier, no PhD required.',
    category: 'AI & ML',
    author: 'Marcus Chen',
    readMinutes: 7,
    publishedAt: '2026-07-20'
  },
  {
    id: 'blog-5',
    title: 'Semantic HTML: The Accessibility Wins You\u2019re Missing',
    excerpt: 'Small markup changes that make a huge difference for screen readers and SEO alike.',
    category: 'Web Development',
    author: 'Sofia Reyes',
    readMinutes: 4,
    publishedAt: '2026-07-24'
  },
  {
    id: 'blog-6',
    title: 'How We Grade Short-Answer Quiz Questions Fairly',
    excerpt: 'A peek behind the curtain at EduForge\u2019s answer-matching and partial-credit logic.',
    category: 'Product',
    author: 'EduForge Team',
    readMinutes: 5,
    publishedAt: '2026-07-27'
  }
];

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'case-1',
    learner: 'Daniela M.',
    role: 'Career switcher \u2192 Junior Developer',
    outcome: 'Landed her first developer role in 5 months',
    quote: 'The structured quizzes kept me honest about what I actually understood versus what I thought I understood.',
    metric: '120+ quizzes completed'
  },
  {
    id: 'case-2',
    learner: 'Ahmed K.',
    role: 'Cloud Support Engineer',
    company: 'Regional MSP',
    outcome: 'Earned AWS + Azure fundamentals, then a promotion',
    quote: 'Comparing AWS, Azure, and GCP side by side on the same platform made the differences finally click.',
    metric: '3 cloud courses completed'
  },
  {
    id: 'case-3',
    learner: 'Wen L.',
    role: 'Data Analyst \u2192 ML Engineer',
    outcome: 'Shipped her first internal ML model in 8 weeks',
    quote: 'The AI Foundations course gave me just enough theory to be dangerous, then let me build.',
    metric: '92% average quiz score'
  }
];

export const INTERVIEWS: Interview[] = [
  {
    id: 'interview-1',
    name: 'Grace Huang',
    title: 'Staff Engineer, Fintech',
    topic: 'What actually gets you hired as a junior developer',
    summary: 'Grace shares what she looks for in take-home projects, and why fundamentals still win over frameworks.'
  },
  {
    id: 'interview-2',
    name: 'Tomás Alvarez',
    title: 'Cloud Architect',
    topic: 'Choosing your first cloud certification',
    summary: 'A pragmatic take on AWS vs Azure vs GCP, and how to avoid "certification collecting" without real skills.'
  },
  {
    id: 'interview-3',
    name: 'Ije Umeh',
    title: 'ML Research Engineer',
    topic: 'Breaking into AI without a PhD',
    summary: 'Ije walks through the self-taught path that got her into applied ML, and the projects that mattered most.'
  },
  {
    id: 'interview-4',
    name: 'Lucas Bennett',
    title: 'Frontend Lead',
    topic: 'Why accessibility should be step one, not step ten',
    summary: 'Practical habits for baking semantic HTML and a11y into your workflow from day one.'
  }
];

/**
 * Deterministically rotates through a content pool based on the current
 * date, so the homepage surfaces a different subset each day (or each
 * `periodDays` window) without needing a backend. Stable across server and
 * client renders since it's derived from the UTC date, not `Math.random()`.
 */
export const pickRotating = <T,>(pool: T[], count: number, periodDays = 1): T[] => {
  if (pool.length === 0 || count <= 0) {
    return [];
  }

  const daysSinceEpoch = Math.floor(Date.now() / 86_400_000);
  const period = Math.max(1, periodDays);
  const offset = (Math.floor(daysSinceEpoch / period) * count) % pool.length;

  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(offset + i) % pool.length]);
};
