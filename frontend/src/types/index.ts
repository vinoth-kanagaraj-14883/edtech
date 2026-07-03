export type UserRole = 'student' | 'instructor' | 'admin';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'all-levels';
export type ContentType = 'video' | 'article' | 'quiz' | 'assignment' | 'link';
export type QuestionType = 'multiple_choice' | 'true_false';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  headline?: string | null;
  bio?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Content {
  id: string;
  title: string;
  type: ContentType;
  body?: string;
  description?: string;
  videoUrl?: string;
  durationMinutes?: number;
  resources?: Array<{
    label: string;
    url: string;
  }>;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  summary?: string;
  order: number;
  durationMinutes?: number;
  videoUrl?: string;
  completed?: boolean;
  completedAt?: string | null;
  content?: Content;
}

export interface Question {
  id: string;
  prompt: string;
  type: QuestionType;
  options: string[];
  explanation?: string;
  correctAnswer?: string;
  points?: number;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  courseId?: string;
  lessonId?: string;
  questionCount?: number;
  timeLimitMinutes?: number;
  questions: Question[];
}

export interface SubmissionAnswer {
  questionId: string;
  answer: string;
}

export interface Submission {
  id?: string;
  quizId: string;
  answers: SubmissionAnswer[];
  score?: number;
  correctCount?: number;
  totalQuestions?: number;
  passed?: boolean;
  feedback?: string;
  submittedAt?: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  userId?: string;
  progress: number;
  completedLessons: number;
  totalLessons: number;
  status: 'not_enrolled' | 'enrolled' | 'in_progress' | 'completed';
  enrolledAt?: string;
  completedAt?: string | null;
}

export interface Course {
  id: string;
  slug?: string;
  title: string;
  description: string;
  shortDescription?: string;
  instructor?: string;
  level: CourseLevel;
  category?: string;
  thumbnailUrl?: string;
  durationHours?: number;
  tags?: string[];
  lessons: Lesson[];
  quizIds?: string[];
  enrolled?: boolean;
  progress?: number;
  enrollment?: Enrollment;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
  read?: boolean;
  link?: string;
}
