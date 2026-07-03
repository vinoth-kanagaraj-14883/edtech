import type {
  Content,
  Course,
  CourseLevel,
  Enrollment,
  Lesson,
  Notification,
  Question,
  Quiz,
  Submission,
  User
} from '@/types';

export class ApiError extends Error {
  status?: number;
  payload?: unknown;

  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export interface ApiContext {
  token?: string | null;
}

interface ApiRequestOptions extends RequestInit, ApiContext {
  baseUrl?: string;
}

interface CourseQuery {
  search?: string;
  level?: string;
}

interface ProfilePayload {
  name: string;
  headline?: string;
  bio?: string;
}

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: User['role'];
}

const SERVER_API_URL = (process.env.API_URL || 'http://api-gateway:8080').replace(/\/$/, '');
const BROWSER_API_URL = (process.env.NEXT_PUBLIC_API_URL || '/api/proxy').replace(/\/$/, '');

const toNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const unwrap = (payload: unknown) => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: unknown }).data;
  }

  return payload;
};

const extractMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  return (
    (payload as { message?: string }).message ||
    (payload as { error?: string }).error ||
    (payload as { details?: string }).details ||
    fallback
  );
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const getBaseUrl = () => (typeof window === 'undefined' ? SERVER_API_URL : BROWSER_API_URL);

const withQuery = (path: string, params: Record<string, string | undefined>) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim()) {
      query.set(key, value.trim());
    }
  });

  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
};

const normalizeContent = (raw: Record<string, unknown>): Content => ({
  id: String(raw.id ?? raw.contentId ?? `content-${Math.random().toString(36).slice(2, 8)}`),
  title: String(raw.title ?? raw.name ?? 'Lesson content'),
  type: (raw.type as Content['type']) ?? 'article',
  body: raw.body ? String(raw.body) : undefined,
  description: raw.description ? String(raw.description) : undefined,
  videoUrl: raw.videoUrl ? String(raw.videoUrl) : undefined,
  durationMinutes: raw.durationMinutes ? toNumber(raw.durationMinutes) : undefined,
  resources: Array.isArray(raw.resources)
    ? raw.resources.map((resource) => ({
        label: String((resource as { label?: string }).label ?? 'Resource'),
        url: String((resource as { url?: string }).url ?? '#')
      }))
    : undefined
});

const normalizeLesson = (raw: Record<string, unknown>, index = 0, courseId = ''): Lesson => ({
  id: String(raw.id ?? raw.lessonId ?? raw.slug ?? `lesson-${index + 1}`),
  courseId: String(raw.courseId ?? courseId),
  title: String(raw.title ?? raw.name ?? `Lesson ${index + 1}`),
  summary: raw.summary ? String(raw.summary) : raw.description ? String(raw.description) : undefined,
  order: toNumber(raw.order ?? raw.position ?? index + 1, index + 1),
  durationMinutes: raw.durationMinutes ? toNumber(raw.durationMinutes) : raw.duration ? toNumber(raw.duration) : undefined,
  videoUrl: raw.videoUrl ? String(raw.videoUrl) : undefined,
  completed: Boolean(raw.completed ?? raw.isCompleted),
  completedAt: raw.completedAt ? String(raw.completedAt) : null,
  content: raw.content && typeof raw.content === 'object' ? normalizeContent(raw.content as Record<string, unknown>) : undefined
});

const normalizeEnrollment = (raw: Record<string, unknown>, courseId: string, lessonCount = 0): Enrollment => {
  const progress = toNumber(raw.progress ?? raw.completionPercentage, 0);
  const completedLessons = toNumber(
    raw.completedLessons ?? raw.completedLessonsCount,
    Math.round((progress / 100) * lessonCount)
  );

  return {
    id: String(raw.id ?? raw.enrollmentId ?? `enrollment-${courseId}`),
    courseId,
    userId: raw.userId ? String(raw.userId) : undefined,
    progress,
    completedLessons,
    totalLessons: toNumber(raw.totalLessons ?? lessonCount, lessonCount),
    status:
      progress >= 100
        ? 'completed'
        : progress > 0
          ? 'in_progress'
          : (raw.status as Enrollment['status']) ?? 'enrolled',
    enrolledAt: raw.enrolledAt ? String(raw.enrolledAt) : undefined,
    completedAt: raw.completedAt ? String(raw.completedAt) : null
  };
};

const normalizeCourse = (raw: Record<string, unknown>): Course => {
  const lessonsRaw = Array.isArray(raw.lessons)
    ? raw.lessons
    : Array.isArray(raw.modules)
      ? raw.modules
      : [];
  const courseId = String(raw.id ?? raw.courseId ?? raw.slug ?? 'course');
  const lessons = lessonsRaw.map((lesson, index) => normalizeLesson(lesson as Record<string, unknown>, index, courseId));
  const enrollmentSource =
    raw.enrollment && typeof raw.enrollment === 'object'
      ? (raw.enrollment as Record<string, unknown>)
      : raw.progress || raw.completedLessons
        ? raw
        : null;
  const enrollment = enrollmentSource ? normalizeEnrollment(enrollmentSource, courseId, lessons.length) : undefined;

  return {
    id: courseId,
    slug: raw.slug ? String(raw.slug) : undefined,
    title: String(raw.title ?? raw.name ?? 'Untitled Course'),
    description: String(raw.description ?? raw.summary ?? 'Course details coming soon.'),
    shortDescription: raw.shortDescription ? String(raw.shortDescription) : undefined,
    instructor: raw.instructor ? String(raw.instructor) : raw.instructorName ? String(raw.instructorName) : undefined,
    level: (raw.level as CourseLevel) ?? 'all-levels',
    category: raw.category ? String(raw.category) : undefined,
    thumbnailUrl: raw.thumbnailUrl ? String(raw.thumbnailUrl) : undefined,
    durationHours: raw.durationHours ? toNumber(raw.durationHours) : raw.duration ? toNumber(raw.duration) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
    lessons,
    quizIds: Array.isArray(raw.quizIds) ? raw.quizIds.map(String) : undefined,
    enrolled: Boolean(raw.enrolled ?? enrollment),
    progress: enrollment?.progress ?? toNumber(raw.progress, 0),
    enrollment
  };
};

const normalizeQuestion = (raw: Record<string, unknown>, index = 0): Question => ({
  id: String(raw.id ?? raw.questionId ?? `question-${index + 1}`),
  prompt: String(raw.prompt ?? raw.question ?? 'Question prompt'),
  type: (raw.type as Question['type']) ?? 'multiple_choice',
  options: Array.isArray(raw.options) ? raw.options.map(String) : ['True', 'False'],
  explanation: raw.explanation ? String(raw.explanation) : undefined,
  correctAnswer: raw.correctAnswer ? String(raw.correctAnswer) : undefined,
  points: raw.points ? toNumber(raw.points) : undefined
});

const normalizeQuiz = (raw: Record<string, unknown>): Quiz => {
  const questionsRaw = Array.isArray(raw.questions)
    ? raw.questions
    : Array.isArray(raw.items)
      ? raw.items
      : [];

  return {
    id: String(raw.id ?? raw.quizId ?? 'quiz'),
    title: String(raw.title ?? raw.name ?? 'Practice Quiz'),
    description: raw.description ? String(raw.description) : undefined,
    courseId: raw.courseId ? String(raw.courseId) : undefined,
    lessonId: raw.lessonId ? String(raw.lessonId) : undefined,
    questionCount: toNumber(raw.questionCount ?? questionsRaw.length, questionsRaw.length),
    timeLimitMinutes: raw.timeLimitMinutes ? toNumber(raw.timeLimitMinutes) : undefined,
    questions: questionsRaw.map((question, index) => normalizeQuestion(question as Record<string, unknown>, index))
  };
};

const normalizeUser = (raw: Record<string, unknown>): User => ({
  id: String(raw.id ?? raw.userId ?? raw.sub ?? 'current-user'),
  name: String(raw.name ?? raw.fullName ?? 'EdTech User'),
  email: String(raw.email ?? ''),
  role: (raw.role as User['role']) ?? 'student',
  avatarUrl: raw.avatarUrl ? String(raw.avatarUrl) : null,
  headline: raw.headline ? String(raw.headline) : null,
  bio: raw.bio ? String(raw.bio) : null,
  createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
  updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined
});

const normalizeNotification = (raw: Record<string, unknown>): Notification => ({
  id: String(raw.id ?? raw.notificationId ?? `notification-${Math.random().toString(36).slice(2, 8)}`),
  title: String(raw.title ?? 'Platform update'),
  message: String(raw.message ?? raw.description ?? ''),
  type: (raw.type as Notification['type']) ?? 'info',
  createdAt: String(raw.createdAt ?? raw.timestamp ?? new Date().toISOString()),
  read: Boolean(raw.read),
  link: raw.link ? String(raw.link) : undefined
});

const getCollection = (payload: unknown, keys: string[]) => {
  const unwrapped = unwrap(payload);

  if (Array.isArray(unwrapped)) {
    return unwrapped;
  }

  if (unwrapped && typeof unwrapped === 'object') {
    for (const key of keys) {
      const candidate = (unwrapped as Record<string, unknown>)[key];
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }

  return [] as unknown[];
};

const apiFetch = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const { baseUrl, token, ...requestInit } = options;
  const headers = new Headers(requestInit.headers);
  const isFormData = typeof FormData !== 'undefined' && requestInit.body instanceof FormData;

  headers.set('Accept', 'application/json');

  if (requestInit.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', 'Bearer ' + token);
  }

  const resolvedBaseUrl = baseUrl ?? getBaseUrl();
  const requestUrl = path.startsWith('http') ? path : `${resolvedBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(requestUrl, {
    ...requestInit,
    headers,
    credentials: requestInit.credentials ?? 'include',
    cache: requestInit.cache ?? 'no-store'
  });

  const text = await response.text();
  const payload = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    throw new ApiError(extractMessage(payload, `Request failed with status ${response.status}.`), response.status, payload);
  }

  return unwrap(payload) as T;
};

const tryPaths = async <T>(paths: string[], transform: (payload: unknown) => T, options: ApiRequestOptions = {}) => {
  let lastError: unknown;

  for (const path of paths) {
    try {
      const payload = await apiFetch<unknown>(path, options);
      return transform(payload);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('API request failed.');
};

export const registerUser = async (payload: RegisterPayload, context: ApiContext = {}) =>
  tryPaths(
    ['/api/auth/register', '/auth/register'],
    (response) => ({
      user:
        response && typeof response === 'object' && 'user' in (response as Record<string, unknown>)
          ? normalizeUser((response as { user: Record<string, unknown> }).user)
          : null
    }),
    {
      method: 'POST',
      body: JSON.stringify(payload),
      token: context.token
    }
  );

export const getCurrentUser = async (context: ApiContext = {}) =>
  tryPaths(
    ['/api/users/me', '/api/auth/me', '/api/profile'],
    (payload) => normalizeUser(payload as Record<string, unknown>),
    { token: context.token }
  );

export const updateProfile = async (payload: ProfilePayload, context: ApiContext = {}) =>
  tryPaths(
    ['/api/users/me', '/api/profile'],
    (response) => normalizeUser(response as Record<string, unknown>),
    {
      method: 'PUT',
      body: JSON.stringify(payload),
      token: context.token
    }
  );

export const getCourses = async (query: CourseQuery = {}, context: ApiContext = {}): Promise<Course[]> => {
  const path = withQuery('/api/courses', {
    search: query.search,
    level: query.level && query.level !== 'all' ? query.level : undefined
  });

  return tryPaths(
    [path, withQuery('/courses', { search: query.search, level: query.level })],
    (payload) =>
      getCollection(payload, ['courses', 'items']).map((course) => normalizeCourse(course as Record<string, unknown>)),
    { token: context.token }
  );
};

export const getEnrolledCourses = async (context: ApiContext = {}): Promise<Course[]> =>
  tryPaths(
    ['/api/enrollments/me', '/api/users/me/courses', '/api/courses?enrolled=true'],
    (payload) => {
      const collection = getCollection(payload, ['enrollments', 'courses', 'items']);
      return collection.map((entry) => {
        const typed = entry as Record<string, unknown>;
        if (typed.course && typeof typed.course === 'object') {
          return normalizeCourse({ ...(typed.course as Record<string, unknown>), enrollment: typed, enrolled: true });
        }

        return normalizeCourse({ ...typed, enrolled: true });
      });
    },
    { token: context.token }
  );

export const getRecentActivity = async (context: ApiContext = {}): Promise<Notification[]> =>
  tryPaths(
    ['/api/notifications', '/api/users/me/activity', '/api/activity'],
    (payload) =>
      getCollection(payload, ['notifications', 'activity', 'items']).map((item) => normalizeNotification(item as Record<string, unknown>)),
    { token: context.token }
  );

export const getCourse = async (id: string, context: ApiContext = {}) =>
  tryPaths(
    [`/api/courses/${id}`, `/courses/${id}`],
    (payload) => normalizeCourse(payload as Record<string, unknown>),
    { token: context.token }
  );

export const enrollInCourse = async (courseId: string, context: ApiContext = {}): Promise<Enrollment> =>
  tryPaths(
    [`/api/courses/${courseId}/enroll`, '/api/enrollments'],
    (payload) => {
      if (payload && typeof payload === 'object' && 'enrollment' in (payload as Record<string, unknown>)) {
        return normalizeEnrollment((payload as { enrollment: Record<string, unknown> }).enrollment, courseId);
      }

      return normalizeEnrollment(payload as Record<string, unknown>, courseId);
    },
    {
      method: 'POST',
      body: JSON.stringify({ courseId }),
      token: context.token
    }
  );

export const getLesson = async (courseId: string, lessonId: string, context: ApiContext = {}) =>
  tryPaths(
    [`/api/courses/${courseId}/lessons/${lessonId}`, `/api/lessons/${lessonId}`],
    (payload) => normalizeLesson(payload as Record<string, unknown>, 0, courseId),
    { token: context.token }
  );

export const markLessonComplete = async (courseId: string, lessonId: string, context: ApiContext = {}): Promise<Lesson> =>
  tryPaths(
    [`/api/courses/${courseId}/lessons/${lessonId}/complete`, `/api/lessons/${lessonId}/complete`],
    (payload) => normalizeLesson(payload as Record<string, unknown>, 0, courseId),
    {
      method: 'POST',
      token: context.token
    }
  );

export const getQuizzes = async (context: ApiContext = {}): Promise<Quiz[]> =>
  tryPaths(
    ['/api/quizzes', '/quizzes'],
    (payload) =>
      getCollection(payload, ['quizzes', 'items']).map((quiz) => normalizeQuiz(quiz as Record<string, unknown>)),
    { token: context.token }
  );

export const getQuiz = async (id: string, context: ApiContext = {}) =>
  tryPaths(
    [`/api/quizzes/${id}`, `/quizzes/${id}`],
    (payload) => normalizeQuiz(payload as Record<string, unknown>),
    { token: context.token }
  );

export const submitQuiz = async (quizId: string, submission: Submission, context: ApiContext = {}): Promise<Submission> =>
  tryPaths(
    [`/api/quizzes/${quizId}/submit`, `/quizzes/${quizId}/submit`],
    (payload) => payload as Submission,
    {
      method: 'POST',
      body: JSON.stringify(submission),
      token: context.token
    }
  );
