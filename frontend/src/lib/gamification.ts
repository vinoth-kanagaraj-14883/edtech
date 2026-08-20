/**
 * Derives the motivation layer (streak, XP, level, daily goal, badges) from the
 * course/enrollment data the API already returns.
 *
 * Design rule: **never invent progress.** Every number here is computed from
 * real `Lesson.completed` / `Lesson.completedAt` / `Enrollment.completedLessons`
 * values. Where the backend does not send per-lesson timestamps, the streak is
 * reported as unavailable (`hasTimestamps: false`) so the UI can soften that
 * panel instead of showing a fabricated number.
 *
 * All functions are pure and safe against partial data, because the dashboard
 * renders them from `Promise.allSettled` results that may be empty.
 */

import type { Course, Lesson } from '@/types';

// ── Tunables ────────────────────────────────────────────────────────────────
export const XP_PER_LESSON = 50;
export const XP_PER_COURSE_COMPLETION = 400;
export const DAILY_GOAL_LESSONS = 5;
/** Safety bound for the level loop; nobody realistically passes this. */
const MAX_LEVEL = 999;

// ── Date helpers ────────────────────────────────────────────────────────────
/** Local-time `YYYY-MM-DD` key. Using local time (not UTC) keeps "today" aligned
 *  with what the learner sees on their own clock. */
function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

// ── Lesson collection ───────────────────────────────────────────────────────
export interface CompletedLesson {
  lesson: Lesson;
  course: Course;
  completedAt: Date | null;
}

/** Every lesson the learner has finished, across all enrolled courses. */
export function collectCompletedLessons(courses: Course[]): CompletedLesson[] {
  const out: CompletedLesson[] = [];
  for (const course of courses) {
    for (const lesson of course.lessons ?? []) {
      if (lesson.completed) {
        out.push({ lesson, course, completedAt: parseDate(lesson.completedAt) });
      }
    }
  }
  return out;
}

/**
 * Total lessons completed. Prefers per-lesson flags, but falls back to the
 * enrollment summary when the API returned courses without expanded lessons —
 * otherwise a learner with real progress would see zero.
 */
export function totalLessonsCompleted(courses: Course[]): number {
  return courses.reduce((sum, course) => {
    const fromLessons = (course.lessons ?? []).filter((lesson) => lesson.completed).length;
    const fromEnrollment = course.enrollment?.completedLessons ?? 0;
    return sum + Math.max(fromLessons, fromEnrollment);
  }, 0);
}

// ── Streak ──────────────────────────────────────────────────────────────────
export interface StreakInfo {
  current: number;
  longest: number;
  /** True when the learner already studied today (streak is "banked"). */
  activeToday: boolean;
  /** False when no lesson carried a usable `completedAt`, so a streak cannot be
   *  computed. The UI must not show a number in that case. */
  hasTimestamps: boolean;
  /** Local day keys that had at least one completion, newest first. */
  activeDays: string[];
}

export function computeStreak(courses: Course[], now: Date = new Date()): StreakInfo {
  const keys = new Set<string>();
  for (const entry of collectCompletedLessons(courses)) {
    if (entry.completedAt) {
      keys.add(dayKey(entry.completedAt));
    }
  }

  if (keys.size === 0) {
    return { current: 0, longest: 0, activeToday: false, hasTimestamps: false, activeDays: [] };
  }

  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(addDays(now, -1));
  const activeToday = keys.has(todayKey);

  // Count back from today. If nothing today, allow starting at yesterday so an
  // in-flight streak is not reported as broken before the learner studies.
  let cursor: Date | null = null;
  if (activeToday) {
    cursor = now;
  } else if (keys.has(yesterdayKey)) {
    cursor = addDays(now, -1);
  }

  let current = 0;
  while (cursor && keys.has(dayKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  // Longest run anywhere in the history.
  const sorted = Array.from(keys).sort(); // ascending YYYY-MM-DD sorts lexically
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of sorted) {
    const date = new Date(`${key}T00:00:00`);
    if (previous && dayKey(addDays(previous, 1)) === key) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    previous = date;
  }

  return {
    current,
    longest: Math.max(longest, current),
    activeToday,
    hasTimestamps: true,
    activeDays: sorted.slice().reverse()
  };
}

// ── XP + levels ─────────────────────────────────────────────────────────────
export interface LevelInfo {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** 0-100, how far through the current level. */
  progressPercent: number;
}

/** Total XP: lessons finished plus a bonus per completed course. */
export function computeXp(courses: Course[]): number {
  const lessons = totalLessonsCompleted(courses);
  const completedCourses = courses.filter((course) => (course.progress ?? 0) >= 100).length;
  return lessons * XP_PER_LESSON + completedCourses * XP_PER_COURSE_COMPLETION;
}

/**
 * Level curve: each level costs 150 XP more than the previous one
 * (300, 450, 600, …). Gentle early progress, meaningful later levels.
 */
export function levelFromXp(xp: number): LevelInfo {
  const safeXp = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  let level = 1;
  let remaining = safeXp;
  let cost = 300;

  while (remaining >= cost && level < MAX_LEVEL) {
    remaining -= cost;
    level += 1;
    cost += 150;
  }

  return {
    xp: safeXp,
    level,
    xpIntoLevel: remaining,
    xpForNextLevel: cost,
    // floor, not round: at 299/300 XP rounding would display "100%" while the
    // learner has not actually levelled up yet.
    progressPercent: cost > 0 ? Math.min(100, Math.floor((remaining / cost) * 100)) : 0
  };
}

// ── Daily goal ──────────────────────────────────────────────────────────────
export interface DailyGoal {
  completedToday: number;
  goal: number;
  percent: number;
  met: boolean;
  hasTimestamps: boolean;
}

export function computeDailyGoal(
  courses: Course[],
  goal: number = DAILY_GOAL_LESSONS,
  now: Date = new Date()
): DailyGoal {
  const completed = collectCompletedLessons(courses);
  const withTimestamps = completed.filter((entry) => entry.completedAt);
  const todayKey = dayKey(now);
  const completedToday = withTimestamps.filter((entry) => dayKey(entry.completedAt as Date) === todayKey).length;

  return {
    completedToday,
    goal,
    percent: goal > 0 ? Math.min(100, Math.round((completedToday / goal) * 100)) : 0,
    met: completedToday >= goal,
    hasTimestamps: withTimestamps.length > 0
  };
}

// ── Continue-learning target ────────────────────────────────────────────────
export interface ContinueTarget {
  course: Course;
  /** First unfinished lesson, if the course has expanded lessons. */
  nextLesson: Lesson | null;
  lessonNumber: number;
  totalLessons: number;
  progress: number;
}

/**
 * Picks the single best course to resume: the in-progress course touched most
 * recently, else the furthest-along unfinished course, else the first enrollment.
 */
export function pickContinueTarget(courses: Course[]): ContinueTarget | null {
  if (!courses.length) {
    return null;
  }

  const unfinished = courses.filter((course) => (course.progress ?? 0) < 100);
  const pool = unfinished.length ? unfinished : courses;

  const lastTouched = (course: Course): number => {
    let latest = 0;
    for (const lesson of course.lessons ?? []) {
      const date = parseDate(lesson.completedAt);
      if (lesson.completed && date) {
        latest = Math.max(latest, date.getTime());
      }
    }
    return latest;
  };

  const ranked = pool.slice().sort((a, b) => {
    const touched = lastTouched(b) - lastTouched(a);
    if (touched !== 0) {
      return touched;
    }
    // No timestamps to separate them — prefer the one closest to finishing, so
    // "resume" points at the course the learner is most invested in.
    const progress = (b.progress ?? 0) - (a.progress ?? 0);
    if (progress !== 0) {
      return progress;
    }
    return (a.title ?? '').localeCompare(b.title ?? '');
  });

  const course = ranked[0];
  if (!course) {
    return null;
  }

  const lessons = (course.lessons ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const nextIndex = lessons.findIndex((lesson) => !lesson.completed);
  const nextLesson = nextIndex >= 0 ? lessons[nextIndex] ?? null : null;
  const totalLessons = lessons.length || course.enrollment?.totalLessons || 0;
  const completedCount =
    lessons.filter((lesson) => lesson.completed).length || course.enrollment?.completedLessons || 0;

  return {
    course,
    nextLesson,
    lessonNumber: nextIndex >= 0 ? nextIndex + 1 : Math.min(completedCount + 1, totalLessons || 1),
    totalLessons,
    progress: Math.max(0, Math.min(100, Math.round(course.progress ?? course.enrollment?.progress ?? 0)))
  };
}

// ── Badges ──────────────────────────────────────────────────────────────────
export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: string;
  unlocked: boolean;
  /** Optional "3/7" style progress toward unlocking. */
  progressLabel?: string;
}

export interface BadgeInputs {
  courses: Course[];
  streak: StreakInfo;
  level: LevelInfo;
}

export function computeBadges({ courses, streak, level }: BadgeInputs): Badge[] {
  const lessons = totalLessonsCompleted(courses);
  const completedCourses = courses.filter((course) => (course.progress ?? 0) >= 100).length;

  const badges: Badge[] = [
    {
      id: 'first-steps',
      label: 'First Steps',
      description: 'Complete your first lesson',
      icon: '🌱',
      unlocked: lessons >= 1,
      progressLabel: lessons >= 1 ? undefined : `${lessons}/1`
    },
    {
      id: 'ten-lessons',
      label: 'Momentum',
      description: 'Complete 10 lessons',
      icon: '⚡',
      unlocked: lessons >= 10,
      progressLabel: lessons >= 10 ? undefined : `${lessons}/10`
    },
    {
      id: 'fifty-lessons',
      label: 'Relentless',
      description: 'Complete 50 lessons',
      icon: '🔩',
      unlocked: lessons >= 50,
      progressLabel: lessons >= 50 ? undefined : `${lessons}/50`
    },
    {
      id: 'week-streak',
      label: 'On Fire',
      description: 'Reach a 7-day streak',
      icon: '🔥',
      unlocked: streak.longest >= 7,
      progressLabel: streak.longest >= 7 ? undefined : `${streak.longest}/7`
    },
    {
      id: 'graduate',
      label: 'Graduate',
      description: 'Finish an entire course',
      icon: '🎓',
      unlocked: completedCourses >= 1,
      progressLabel: completedCourses >= 1 ? undefined : `${completedCourses}/1`
    },
    {
      id: 'level-five',
      label: 'Ascendant',
      description: 'Reach level 5',
      icon: '💎',
      unlocked: level.level >= 5,
      progressLabel: level.level >= 5 ? undefined : `${level.level}/5`
    }
  ];

  return badges;
}

// ── Aggregate ───────────────────────────────────────────────────────────────
export interface LearnerStats {
  streak: StreakInfo;
  level: LevelInfo;
  dailyGoal: DailyGoal;
  badges: Badge[];
  continueTarget: ContinueTarget | null;
  lessonsCompleted: number;
  coursesCompleted: number;
  coursesInProgress: number;
}

/** One call the dashboard can make to get the whole motivation layer. */
export function buildLearnerStats(courses: Course[], now: Date = new Date()): LearnerStats {
  const safeCourses = Array.isArray(courses) ? courses : [];
  const streak = computeStreak(safeCourses, now);
  const level = levelFromXp(computeXp(safeCourses));

  return {
    streak,
    level,
    dailyGoal: computeDailyGoal(safeCourses, DAILY_GOAL_LESSONS, now),
    badges: computeBadges({ courses: safeCourses, streak, level }),
    continueTarget: pickContinueTarget(safeCourses),
    lessonsCompleted: totalLessonsCompleted(safeCourses),
    coursesCompleted: safeCourses.filter((course) => (course.progress ?? 0) >= 100).length,
    coursesInProgress: safeCourses.filter(
      (course) => (course.progress ?? 0) > 0 && (course.progress ?? 0) < 100
    ).length
  };
}
