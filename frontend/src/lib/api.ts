import type {
  Certificate,
  Content,
  Course,
  CourseLevel,
  Enrollment,
  Lesson,
  Payment,
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

  // FastAPI (user-service) returns errors as { detail: "..." } for
  // HTTPException, or { detail: [{ loc, msg, type }, ...] } for Pydantic
  // validation errors (422). Handle both shapes before falling back to
  // other common error field names.
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail.trim().length > 0) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((item) => (item && typeof item === 'object' ? (item as { msg?: string }).msg : undefined))
      .filter((msg): msg is string => Boolean(msg));
    if (messages.length > 0) {
      return messages.join(', ');
    }
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
  // content-service stores `orderIndex` (0-based) and `durationSeconds`; the UI
  // works in 1-based order and whole minutes. Accept both shapes so lessons
  // render whether they come embedded in a course or straight from /api/lessons.
  order:
    raw.order !== undefined || raw.position !== undefined
      ? toNumber(raw.order ?? raw.position, index + 1)
      : raw.orderIndex !== undefined
        ? toNumber(raw.orderIndex, index) + 1
        : index + 1,
  durationMinutes: raw.durationMinutes
    ? toNumber(raw.durationMinutes)
    : raw.duration
      ? toNumber(raw.duration)
      : raw.durationSeconds
        ? Math.max(1, Math.round(toNumber(raw.durationSeconds) / 60))
        : undefined,
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

// Backend course-service returns Java enum names (e.g. "BEGINNER"), while the
// frontend's CourseLevel type/UI uses lowercase kebab values.
const normalizeLevel = (value: unknown): CourseLevel => {
  const normalized = String(value ?? '').toLowerCase().replace(/_/g, '-');
  if (normalized === 'beginner' || normalized === 'intermediate' || normalized === 'advanced' || normalized === 'all-levels') {
    return normalized;
  }
  return 'all-levels';
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
    instructorId: raw.instructorId ? String(raw.instructorId) : undefined,
    price: raw.price !== undefined ? toNumber(raw.price) : undefined,
    status: raw.status ? String(raw.status) : undefined,
    level: normalizeLevel(raw.level),
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

const normalizeQuestion = (raw: Record<string, unknown>, index = 0): Question => {
  const type = (raw.type as Question['type']) ?? 'multiple_choice';

  return {
    id: String(raw.id ?? raw.questionId ?? `question-${index + 1}`),
    prompt: String(raw.prompt ?? raw.question ?? 'Question prompt'),
    type,
    options: Array.isArray(raw.options) ? raw.options.map(String) : type === 'true_false' ? ['True', 'False'] : [],
    explanation: raw.explanation ? String(raw.explanation) : undefined,
    correctAnswer: raw.correctAnswer ? String(raw.correctAnswer) : undefined,
    points: raw.points ? toNumber(raw.points) : undefined
  };
};

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
  name: String(raw.name ?? raw.fullName ?? 'EduForge User'),
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

/**
 * Should a failed candidate path fall through to the next one?
 *
 * Only when the failure means "this route does not exist here" (404/405) or the
 * request never reached a server at all. Every other status — 400, 401, 403,
 * 409, 422, 5xx — is a real answer from a real endpoint and must propagate.
 *
 * Previously `tryPaths` swallowed *every* error and threw whichever one came
 * last, so a meaningful response was routinely masked by a fallback's 404. The
 * concrete symptom: enrolling in a course you already had returned a correct
 * `409 Conflict`, which was discarded in favour of `404 route not found` from
 * the `/api/enrollments` fallback — making a clear "already enrolled" look like
 * a broken gateway, and defeating any caller trying to handle the 409.
 */
const shouldTryNextPath = (error: unknown): boolean => {
  if (error instanceof ApiError && typeof error.status === 'number') {
    return error.status === 404 || error.status === 405;
  }

  // Network error, timeout, or unparseable response: the next candidate is worth a go.
  return true;
};

const tryPaths = async <T>(paths: string[], transform: (payload: unknown) => T, options: ApiRequestOptions = {}) => {
  let lastError: unknown;

  for (const path of paths) {
    try {
      const payload = await apiFetch<unknown>(path, options);
      return transform(payload);
    } catch (error) {
      lastError = error;
      if (!shouldTryNextPath(error)) {
        throw error;
      }
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
      // The user-service expects `full_name`; the form collects `name`.
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        full_name: payload.name,
        role: payload.role
      }),
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
      // Backend UserUpdate expects `full_name`/`bio`; the form uses `name`.
      body: JSON.stringify({
        full_name: payload.name,
        ...(payload.bio !== undefined ? { bio: payload.bio } : {})
      }),
      token: context.token
    }
  );

export const getCourses = async (query: CourseQuery = {}, context: ApiContext = {}): Promise<Course[]> => {
  // course-service (Java) binds `level` to a Java enum (BEGINNER/INTERMEDIATE/
  // ADVANCED); the frontend's filter UI uses lowercase values.
  const backendLevel = query.level && query.level !== 'all' ? query.level.toUpperCase() : undefined;
  const hasSearch = Boolean(query.search && query.search.trim());

  // When the user is actually searching, go through the dedicated
  // search-service (fast, hot-course-cached) via /api/search. It returns the
  // same {courses,...} shape as course-service. Fall back to /api/courses and
  // /courses if the search-service is unavailable, so the catalog still works.
  const searchPaths = hasSearch
    ? [
        withQuery('/api/search', { q: query.search, level: backendLevel }),
        withQuery('/api/courses', { search: query.search, level: backendLevel }),
        withQuery('/courses', { search: query.search, level: backendLevel })
      ]
    : [
        withQuery('/api/courses', { level: backendLevel }),
        withQuery('/courses', { level: backendLevel })
      ];

  return tryPaths(
    searchPaths,
    (payload) =>
      getCollection(payload, ['courses', 'items']).map((course) => normalizeCourse(course as Record<string, unknown>)),
    { token: context.token }
  );
};

/**
 * The learner's enrolled courses.
 *
 * `/api/courses?enrolled=true` is listed FIRST because it is the one that
 * actually works: course-service resolves the user from the gateway-injected
 * identity and returns only their enrolments. The other two are kept as
 * fallbacks for older deployments, but they 404 here — `/api/enrollments/me`
 * has no gateway route at all, and `/api/users/*` is routed to user-service
 * (which answers `{"detail":"Not Found"}`), so course-service's own
 * `/users/{id}/enrollments` is unreachable through the gateway. Having them
 * first cost two wasted 404 round-trips on every dashboard render.
 */
export const getEnrolledCourses = async (context: ApiContext = {}): Promise<Course[]> =>
  tryPaths(
    ['/api/courses?enrolled=true', '/api/enrollments/me', '/api/users/me/courses'],
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

/**
 * Lessons for a course. They live in content-service, NOT in course-service's
 * course DTO, so they have to be fetched separately.
 */
// ── Payments ────────────────────────────────────────────────────────────────
// payment-service was fully wired at the gateway (/api/payments) but nothing in
// the frontend ever called it, so paid courses could be enrolled in for free and
// no receipt was ever shown. These are the client bindings for it.

const normalizePayment = (raw: Record<string, unknown>): Payment => ({
  id: String(raw.id ?? ''),
  userId: raw.userId ? String(raw.userId) : raw.user_id ? String(raw.user_id) : undefined,
  courseId: String(raw.courseId ?? raw.course_id ?? ''),
  amount: toNumber(raw.amount, 0),
  currency: String(raw.currency ?? 'USD'),
  status: String(raw.status ?? 'unknown'),
  provider: raw.provider ? String(raw.provider) : undefined,
  providerRef: raw.providerRef ? String(raw.providerRef) : raw.provider_ref ? String(raw.provider_ref) : null,
  createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
  updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined
});

/**
 * Charges for a course. payment-service resolves the user from the
 * gateway-injected identity, so only the course (and optionally an explicit
 * amount) is sent. `amount` is omitted for the normal flow so the service
 * authoritatively prices the course rather than trusting the client.
 */
export const createPayment = async (
  courseId: string,
  context: ApiContext = {},
  amount?: number
): Promise<Payment> =>
  tryPaths(
    ['/api/payments', '/payments'],
    (payload) => normalizePayment(unwrap(payload) as Record<string, unknown>),
    {
      method: 'POST',
      body: JSON.stringify(amount !== undefined ? { courseId, amount } : { courseId }),
      token: context.token
    }
  );

export const getMyPayments = async (context: ApiContext = {}): Promise<Payment[]> =>
  tryPaths(
    ['/api/payments', '/payments'],
    (payload) =>
      getCollection(payload, ['payments', 'items']).map((p) => normalizePayment(p as Record<string, unknown>)),
    { token: context.token }
  );

export const refundPayment = async (paymentId: string, context: ApiContext = {}): Promise<Payment> =>
  tryPaths(
    [`/api/payments/${paymentId}/refund`, `/payments/${paymentId}/refund`],
    (payload) => normalizePayment(unwrap(payload) as Record<string, unknown>),
    { method: 'POST', token: context.token }
  );

export const getCourseLessons = async (courseId: string, context: ApiContext = {}): Promise<Lesson[]> =>
  tryPaths(
    [
      `/api/lessons?courseId=${encodeURIComponent(courseId)}&limit=100`,
      `/lessons?courseId=${encodeURIComponent(courseId)}&limit=100`
    ],
    (payload) =>
      getCollection(payload, ['items', 'lessons', 'content'])
        .map((lesson, index) => normalizeLesson(lesson as Record<string, unknown>, index, courseId))
        .sort((a, b) => a.order - b.order),
    { token: context.token }
  );

export const getCourse = async (id: string, context: ApiContext = {}): Promise<Course> => {
  // course-service's course payload contains no `lessons` field at all, so
  // normalizing it alone always yielded an empty curriculum. Fetch the lessons
  // from content-service alongside it and merge. The lesson fetch is allowed to
  // fail softly: a course page with no curriculum is much better than a course
  // page that 500s because content-service is down or being chaos-tested.
  const [course, lessons, completions] = await Promise.all([
    tryPaths(
      [`/api/courses/${id}`, `/courses/${id}`],
      (payload) => normalizeCourse(payload as Record<string, unknown>),
      { token: context.token }
    ),
    getCourseLessons(id, context).catch(() => [] as Lesson[]),
    getCourseProgress(id, context).catch(() => [] as LessonCompletion[])
  ]);

  // Prefer lessons the course payload already embedded (some deployments do),
  // and only fall back to the separately-fetched ones. Either way, stamp the
  // learner's completion state on top so the curriculum shows ticks and the
  // XP/streak layer has real timestamps to work from.
  const base = course.lessons.length > 0 ? course.lessons : lessons;
  const merged = applyProgressToLessons(base, completions);
  const completedCount = merged.filter((lesson) => lesson.completed).length;

  return {
    ...course,
    lessons: merged,
    progress:
      course.progress ??
      (merged.length > 0 ? Math.round((completedCount / merged.length) * 100) : undefined)
  };
};

/**
 * Enrolled courses with their lessons and completion state resolved.
 *
 * The dashboard needs this rather than plain `getEnrolledCourses`, because the
 * course list carries no lessons and therefore no completion timestamps — which
 * is why the streak and XP tiles were empty. One extra round-trip pair per
 * enrolled course, which is fine for a learner's handful of courses.
 */
export const getEnrolledCoursesDetailed = async (context: ApiContext = {}): Promise<Course[]> => {
  const courses = await getEnrolledCourses(context).catch(() => [] as Course[]);

  return Promise.all(
    courses.map(async (course) => {
      const [lessons, completions] = await Promise.all([
        course.lessons.length > 0
          ? Promise.resolve(course.lessons)
          : getCourseLessons(course.id, context).catch(() => [] as Lesson[]),
        getCourseProgress(course.id, context).catch(() => [] as LessonCompletion[])
      ]);

      const merged = applyProgressToLessons(lessons, completions);
      const completedCount = merged.filter((lesson) => lesson.completed).length;

      return {
        ...course,
        lessons: merged,
        progress:
          course.progress ??
          (merged.length > 0 ? Math.round((completedCount / merged.length) * 100) : course.progress),
        enrollment: course.enrollment
          ? { ...course.enrollment, completedLessons: completedCount, totalLessons: merged.length }
          : course.enrollment
      };
    })
  );
};

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

// Removes the current user's enrollment. course-service resolves the user
// from the gateway-injected X-User-Id header, so no body is required.
export const unenrollFromCourse = async (courseId: string, context: ApiContext = {}): Promise<void> => {
  await tryPaths(
    [`/api/courses/${courseId}/enroll`, `/courses/${courseId}/enroll`],
    () => undefined,
    {
      method: 'DELETE',
      token: context.token
    }
  );
};

export interface CreateCourseInput {
  title: string;
  description: string;
  instructorId: string;
  price?: number;
  durationHours: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  thumbnailUrl?: string;
  tags?: string[];
}

// Instructor-only: course-service authorizes writes based on the
// X-User-Role header the gateway sets after JWT validation (mirrors
// quiz-service's createQuiz pattern) -- 403s for non-instructor accounts.
export const createCourse = async (input: CreateCourseInput, context: ApiContext = {}): Promise<Course> =>
  tryPaths(
    ['/api/courses', '/courses'],
    (payload) => normalizeCourse(payload as Record<string, unknown>),
    {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        instructorId: input.instructorId,
        price: input.price ?? 0,
        durationHours: input.durationHours,
        level: input.level.toUpperCase(),
        status: input.status ?? 'PUBLISHED',
        thumbnailUrl: input.thumbnailUrl,
        tags: input.tags ?? []
      }),
      token: context.token
    }
  );

export const updateCourse = async (id: string, input: CreateCourseInput, context: ApiContext = {}): Promise<Course> =>
  tryPaths(
    [`/api/courses/${id}`, `/courses/${id}`],
    (payload) => normalizeCourse(payload as Record<string, unknown>),
    {
      method: 'PUT',
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        instructorId: input.instructorId,
        price: input.price ?? 0,
        durationHours: input.durationHours,
        level: input.level.toUpperCase(),
        status: input.status ?? 'PUBLISHED',
        thumbnailUrl: input.thumbnailUrl,
        tags: input.tags ?? []
      }),
      token: context.token
    }
  );

export const deleteCourse = async (id: string, context: ApiContext = {}): Promise<void> => {
  await tryPaths(
    [`/api/courses/${id}`, `/courses/${id}`],
    () => undefined,
    {
      method: 'DELETE',
      token: context.token
    }
  );
};

// Creates a lesson (content-service) attached to a course, optionally with
// a body of article/document content.
export interface CreateLessonInput {
  courseId: string;
  title: string;
  description?: string;
  orderIndex: number;
  durationMinutes?: number;
  articleBody?: string;
  videoUrl?: string;
}

export const createLesson = async (input: CreateLessonInput, context: ApiContext = {}): Promise<Lesson> => {
  const lesson = await tryPaths(
    ['/api/lessons', '/lessons'],
    (payload) => normalizeLesson(((payload as { lesson?: unknown }).lesson ?? payload) as Record<string, unknown>, input.orderIndex, input.courseId),
    {
      method: 'POST',
      body: JSON.stringify({
        courseId: input.courseId,
        title: input.title,
        description: input.description,
        orderIndex: input.orderIndex,
        durationSeconds: (input.durationMinutes ?? 5) * 60,
        isPublished: true
      }),
      token: context.token
    }
  );

  if (input.videoUrl) {
    await tryPaths([`/api/content`, '/content'], () => undefined, {
      method: 'POST',
      body: JSON.stringify({
        lessonId: lesson.id,
        type: 'VIDEO',
        url: input.videoUrl,
        filename: `${input.title}.mp4`,
        mimeType: 'video/mp4',
        sizeBytes: 0
      }),
      token: context.token
    }).catch(() => undefined);
  } else if (input.articleBody) {
    await tryPaths([`/api/content`, '/content'], () => undefined, {
      method: 'POST',
      body: JSON.stringify({
        lessonId: lesson.id,
        type: 'DOCUMENT',
        url: `https://learn.eduforge.dev/articles/${lesson.id}`,
        filename: `${input.title}.md`,
        mimeType: 'text/markdown',
        sizeBytes: new TextEncoder().encode(input.articleBody).length
      }),
      token: context.token
    }).catch(() => undefined);
  }

  return lesson;
};

export const getLesson = async (courseId: string, lessonId: string, context: ApiContext = {}) =>
  tryPaths(
    [`/api/courses/${courseId}/lessons/${lessonId}`, `/api/lessons/${lessonId}`],
    (payload) => normalizeLesson(payload as Record<string, unknown>, 0, courseId),
    { token: context.token }
  );

/**
 * Marks a lesson complete.
 *
 * The first path is course-service, which persists the completion into
 * `course_progress` and recomputes the enrolment percentage. `totalLessons` is
 * passed so it can work out that percentage — lessons live in content-service,
 * so course-service cannot count them itself. The second path is
 * content-service's older acknowledge-only endpoint, kept purely as a fallback.
 */
/**
 * Tells tracking-service a lesson was completed.
 *
 * This is not bookkeeping — tracking-service owns course-completion detection
 * and certificate issuance. It counts `lesson.completed` events against the
 * course's lesson total and, when they match, issues the certificate. Without
 * this event a learner can finish every lesson and never receive one, which is
 * exactly what was happening: completions were persisted by course-service and
 * tracking-service never heard about them.
 */
export const recordLessonCompleted = async (
  courseId: string,
  lessonId: string,
  context: ApiContext = {}
): Promise<void> => {
  await tryPaths(
    ['/api/tracking/events'],
    () => undefined,
    {
      method: 'POST',
      // user_id is omitted deliberately: tracking-service falls back to the
      // gateway-injected X-User-Id, which the client cannot forge.
      body: JSON.stringify({
        course_id: courseId,
        lesson_id: lessonId,
        event_type: 'lesson.completed'
      }),
      token: context.token
    }
  );
};

export const markLessonComplete = async (
  courseId: string,
  lessonId: string,
  context: ApiContext = {},
  totalLessons?: number
): Promise<Lesson> => {
  const lesson = await tryPaths(
    [`/api/courses/${courseId}/lessons/${lessonId}/complete`, `/api/lessons/${lessonId}/complete`],
    (payload) => normalizeLesson(payload as Record<string, unknown>, 0, courseId),
    {
      method: 'POST',
      body: JSON.stringify(totalLessons && totalLessons > 0 ? { totalLessons } : {}),
      token: context.token
    }
  );

  // Fire the completion event so the certificate pipeline runs. Failing soft:
  // the completion itself is already durable in course-service, and
  // tracking-service reconciles on the next progress read.
  await recordLessonCompleted(courseId, lessonId, context).catch(() => undefined);

  return lesson;
};

// ── Certificates ────────────────────────────────────────────────────────────

const normalizeCertificate = (raw: Record<string, unknown>): Certificate => ({
  id: String(raw.id ?? ''),
  certificateNumber: String(raw.certificateNumber ?? raw.certificate_number ?? ''),
  userId: raw.userId ? String(raw.userId) : undefined,
  userName: raw.userName ? String(raw.userName) : null,
  courseId: String(raw.courseId ?? raw.course_id ?? ''),
  courseTitle: raw.courseTitle ? String(raw.courseTitle) : null,
  issuedAt: raw.issuedAt ? String(raw.issuedAt) : undefined,
  status: String(raw.status ?? 'issued')
});

/** The learner's certificates. */
export const getMyCertificates = async (context: ApiContext = {}): Promise<Certificate[]> =>
  tryPaths(
    ['/api/certificates'],
    (payload) =>
      getCollection(payload, ['certificates', 'items']).map((c) =>
        normalizeCertificate(c as Record<string, unknown>)
      ),
    { token: context.token }
  );

export interface LessonCompletion {
  lessonId: string;
  completedAt: string | null;
}

/** Which lessons the learner has completed in a course (empty if not enrolled). */
export const getCourseProgress = async (
  courseId: string,
  context: ApiContext = {}
): Promise<LessonCompletion[]> =>
  tryPaths(
    [`/api/courses/${courseId}/progress`],
    (payload) => {
      const raw = unwrap(payload) as Record<string, unknown> | null;
      const completions = Array.isArray(raw?.completions) ? (raw?.completions as Record<string, unknown>[]) : [];
      if (completions.length > 0) {
        return completions.map((c) => ({
          lessonId: String(c.lessonId ?? ''),
          completedAt: c.completedAt ? String(c.completedAt) : null
        }));
      }
      // Fall back to the id-only list if `completions` is absent.
      const ids = Array.isArray(raw?.completedLessonIds) ? (raw?.completedLessonIds as unknown[]) : [];
      return ids.map((id) => ({ lessonId: String(id), completedAt: null }));
    },
    { token: context.token }
  );

/**
 * Stamps completion state onto a lesson list. This is what makes the whole
 * motivation layer real: `Lesson.completed` / `completedAt` are the inputs the
 * XP, level, streak and daily-goal calculations read (see lib/gamification.ts),
 * and before completions were persisted they were always false/null, so every
 * learner sat at 0 XP with no streak.
 */
const applyProgressToLessons = (lessons: Lesson[], completions: LessonCompletion[]): Lesson[] => {
  if (completions.length === 0) {
    return lessons;
  }
  const byId = new Map(completions.map((c) => [c.lessonId, c]));
  return lessons.map((lesson) => {
    const hit = byId.get(lesson.id);
    if (!hit) {
      return lesson;
    }
    return { ...lesson, completed: true, completedAt: hit.completedAt ?? lesson.completedAt ?? null };
  });
};

export const getQuizzes = async (context: ApiContext = {}): Promise<Quiz[]> =>
  tryPaths(
    ['/api/quizzes', '/quizzes'],
    (payload) =>
      getCollection(payload, ['quizzes', 'items']).map((quiz) => normalizeQuiz(quiz as Record<string, unknown>)),
    { token: context.token }
  );

// Unauthenticated preview used on the public landing page: a couple of
// sample quizzes (correct answers redacted server-side) to entice visitors
// to sign up before they can submit and see results.
export const getPublicQuizzes = async (limit = 2): Promise<Quiz[]> =>
  tryPaths(
    [`/api/quizzes/public?limit=${limit}`, `/quizzes/public?limit=${limit}`],
    (payload) =>
      getCollection(payload, ['quizzes', 'items']).map((quiz) => normalizeQuiz(quiz as Record<string, unknown>))
  );

export const getQuiz = async (id: string, context: ApiContext = {}) =>
  tryPaths(
    [`/api/quizzes/${id}`, `/quizzes/${id}`],
    (payload) => normalizeQuiz(payload as Record<string, unknown>),
    { token: context.token }
  );

export interface QuizQuestionInput {
  text: string;
  questionType: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correctAnswer: string;
  points?: number;
  orderIndex?: number;
}

export interface CreateQuizInput {
  courseId: string;
  title: string;
  description?: string;
  timeLimitMinutes?: number;
  passingScore?: number;
  isPublished?: boolean;
  questions: QuizQuestionInput[];
}

// Instructor-only: creates a quiz, then adds each question sequentially.
// quiz-service authorizes writes based on the X-User-Role header the
// gateway sets after validating the JWT (see api-gateway authMiddleware),
// so this will 403 for any non-instructor account.
export const createQuiz = async (input: CreateQuizInput, context: ApiContext = {}): Promise<Quiz> => {
  const quiz = await tryPaths(
    ['/api/quizzes', '/quizzes'],
    (payload) => normalizeQuiz(((payload as { quiz?: unknown }).quiz ?? payload) as Record<string, unknown>),
    {
      method: 'POST',
      body: JSON.stringify({
        courseId: input.courseId,
        title: input.title,
        description: input.description,
        timeLimitMinutes: input.timeLimitMinutes,
        passingScore: input.passingScore,
        isPublished: input.isPublished ?? true
      }),
      token: context.token
    }
  );

  for (const [index, question] of input.questions.entries()) {
    await tryPaths(
      [`/api/quizzes/${quiz.id}/questions`, `/quizzes/${quiz.id}/questions`],
      (payload) => payload,
      {
        method: 'POST',
        body: JSON.stringify({
          text: question.text,
          questionType: question.questionType,
          options: question.options,
          correctAnswer: question.correctAnswer,
          points: question.points ?? 1,
          orderIndex: question.orderIndex ?? index
        }),
        token: context.token
      }
    );
  }

  return getQuiz(quiz.id, context);
};

export const submitQuiz = async (quizId: string, submission: Submission, context: ApiContext = {}): Promise<Submission> => {
  // quiz-service expects `answers` as an object keyed by question id
  // (e.g. { "1": "answer text" }), not the array-of-{questionId,answer}
  // shape used internally by the frontend for rendering/state.
  const answersById = submission.answers.reduce<Record<string, string>>((acc, { questionId, answer }) => {
    acc[questionId] = answer;
    return acc;
  }, {});

  return tryPaths(
    [`/api/quizzes/${quizId}/submit`, `/quizzes/${quizId}/submit`],
    (payload) => payload as Submission,
    {
      method: 'POST',
      body: JSON.stringify({ ...submission, answers: answersById }),
      token: context.token
    }
  );
};
