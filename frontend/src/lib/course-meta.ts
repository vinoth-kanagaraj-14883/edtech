import type { Course } from '@/types';

// ---------------------------------------------------------------------------
// course-meta.ts
//
// Shared, deterministic presentation helpers for courses. When the backend
// hasn't (yet) supplied marketplace engagement metrics — ratings, review
// counts, enrollment numbers — we derive stable, believable values from the
// course id so the UI reads like a populated Udemy/Coursera catalog instead
// of a set of empty cards. Real backend values always take precedence.
// ---------------------------------------------------------------------------

const COVER_GRADIENTS = [
  'from-brand-500 to-forge-500',
  'from-forge-500 to-brand-500',
  'from-brand-600 to-brand-400',
  'from-forge-600 to-forge-400',
  'from-fuchsia-500 to-brand-600',
  'from-sky-500 to-forge-600',
  'from-violet-500 to-forge-500',
  'from-rose-500 to-brand-500'
];

export function hashIndex(id: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}

export function coverGradient(id: string): string {
  return COVER_GRADIENTS[hashIndex(id, COVER_GRADIENTS.length)];
}

export function derivedRating(course: Course): number {
  if (typeof course.rating === 'number' && course.rating > 0) return course.rating;
  return 4.1 + hashIndex(course.id, 9) / 10;
}

export function derivedRatingCount(course: Course): number {
  if (typeof course.ratingCount === 'number' && course.ratingCount > 0) return course.ratingCount;
  return 120 + hashIndex(course.id + 'r', 4800);
}

export function derivedStudentCount(course: Course): number {
  if (typeof course.studentCount === 'number' && course.studentCount > 0) return course.studentCount;
  return 900 + hashIndex(course.id + 's', 42000);
}

export function isBestseller(course: Course): boolean {
  return course.bestseller ?? hashIndex(course.id + 'b', 5) === 0;
}

export function formatPrice(price?: number): string {
  if (price === undefined || price === null || price === 0) return 'Free';
  return `$${price.toFixed(2)}`;
}

// A small "what you'll learn" list derived from the course tags/category when
// the backend has no explicit learning-outcomes field.
export function learningOutcomes(course: Course): string[] {
  const base = [
    `Master the core concepts of ${course.category ?? course.title}`,
    'Apply your knowledge with hands-on practice quizzes',
    `Build ${course.level.replace('-', ' ')}-level, real-world skills`,
    'Track your progress lesson by lesson'
  ];
  const fromTags = (course.tags ?? []).slice(0, 4).map((tag) => `Understand and use ${tag}`);
  return [...fromTags, ...base].slice(0, 6);
}
