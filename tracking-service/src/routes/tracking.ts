import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { Router } from 'express';

import { redis } from '../chaos';
import { AppDataSource } from '../database';
import { logger } from '../logger';
import { certificatesTriggeredTotal, trackingEventsTotal } from '../metrics';
import { CertificateIssue } from '../models/CertificateIssue';
import { TRACKING_EVENT_TYPES, TrackingEvent, TrackingEventType } from '../models/TrackingEvent';

const router = Router();

const CONTENT_SERVICE_URL = (process.env.CONTENT_SERVICE_URL ?? 'http://content-service:8003').replace(/\/$/, '');
const CERTIFICATION_SERVICE_URL = (process.env.CERTIFICATION_SERVICE_URL ?? 'http://certification-service:8009').replace(/\/$/, '');
const LESSON_COUNT_CACHE_TTL_MS = 60_000;

const tracer = trace.getTracer('tracking-service');

// ── Outbound fetch with explicit trace propagation ─────────────────────────
// Node's auto-instrumentation does NOT patch the global fetch (undici) client,
// so the W3C traceparent header must be injected manually and a CLIENT span
// started by hand — otherwise downstream services appear as disconnected root
// traces and the service-dependency graph loses the edge (same pattern as
// search-service).
const tracedFetch = async (
  spanName: string,
  peerService: string,
  url: string,
  init: RequestInit = {}
): Promise<globalThis.Response> => {
  const span = tracer.startSpan(spanName, {
    kind: SpanKind.CLIENT,
    attributes: {
      'http.method': init.method ?? 'GET',
      'http.url': url,
      'peer.service': peerService
    }
  });

  try {
    return await context.with(trace.setSpan(context.active(), span), async () => {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(init.headers as Record<string, string> | undefined)
      };
      propagation.inject(context.active(), headers);

      const response = await fetch(url, { ...init, headers });
      span.setAttribute('http.status_code', response.status);
      if (!response.ok) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      return response;
    });
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
};

// ── Per-course total-lesson count (from content-service, cached 60s) ───────
// Content-service supports GET /lessons?courseId=<uuid>&page=&limit= and
// returns { items, page, limit, total, totalPages }, so the server-side
// courseId filter is used and only `total` is needed (limit=1 keeps it cheap).
interface LessonCountCacheEntry {
  count: number;
  fetchedAt: number;
}

const lessonCountCache = new Map<string, LessonCountCacheEntry>();

const getCourseLessonCount = async (courseId: string): Promise<number> => {
  const cached = lessonCountCache.get(courseId);
  if (cached && Date.now() - cached.fetchedAt < LESSON_COUNT_CACHE_TTL_MS) {
    return cached.count;
  }

  try {
    const url = `${CONTENT_SERVICE_URL}/lessons?courseId=${encodeURIComponent(courseId)}&limit=1&page=1`;
    const response = await tracedFetch('GET /lessons', 'content-service', url);
    if (!response.ok) {
      throw new Error(`content-service responded ${response.status}`);
    }
    const body = (await response.json()) as { total?: number; items?: Array<{ courseId?: string }> };
    const total =
      typeof body.total === 'number'
        ? body.total
        : // Fallback: filter client-side if the response shape ever changes.
          (body.items ?? []).filter((lesson) => lesson.courseId === courseId).length;

    lessonCountCache.set(courseId, { count: total, fetchedAt: Date.now() });
    return total;
  } catch (error) {
    logger.warn('failed to fetch lesson count from content-service', {
      course_id: courseId,
      error: error instanceof Error ? error.message : String(error)
    });
    // Serve a stale cached value rather than nothing if we have one.
    return cached?.count ?? 0;
  }
};

// ── Progress queries ────────────────────────────────────────────────────────
const countCompletedLessons = async (userId: string, courseId: string): Promise<number> => {
  const row = await AppDataSource.getRepository(TrackingEvent)
    .createQueryBuilder('event')
    .select('COUNT(DISTINCT event.lessonId)', 'completed')
    .where('event.userId = :userId', { userId })
    .andWhere('event.courseId = :courseId', { courseId })
    .andWhere('event.eventType = :eventType', { eventType: TrackingEventType.LESSON_COMPLETED })
    .andWhere('event.lessonId IS NOT NULL')
    .getRawOne<{ completed: string }>();

  return Number(row?.completed ?? 0);
};

interface CourseProgress {
  course_id: string;
  completed_lessons: number;
  total_lessons: number;
  percent: number;
  quiz_events: number;
  last_activity: string | null;
  certificate_triggered: boolean;
}

const buildCourseProgress = async (userId: string, courseId: string): Promise<CourseProgress> => {
  const eventRepository = AppDataSource.getRepository(TrackingEvent);

  const [completedLessons, totalLessons, quizEvents, lastActivityRow, certificate] = await Promise.all([
    countCompletedLessons(userId, courseId),
    getCourseLessonCount(courseId),
    eventRepository.count({
      where: { userId, courseId, eventType: TrackingEventType.QUIZ_SUBMITTED }
    }),
    eventRepository
      .createQueryBuilder('event')
      .select('MAX(event.createdAt)', 'lastActivity')
      .where('event.userId = :userId', { userId })
      .andWhere('event.courseId = :courseId', { courseId })
      .getRawOne<{ lastActivity: Date | string | null }>(),
    AppDataSource.getRepository(CertificateIssue).findOne({ where: { userId, courseId } })
  ]);

  const percent = totalLessons > 0 ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 0;
  const lastActivityValue = lastActivityRow?.lastActivity ?? null;

  return {
    course_id: courseId,
    completed_lessons: completedLessons,
    total_lessons: totalLessons,
    percent,
    quiz_events: quizEvents,
    last_activity: lastActivityValue === null ? null : new Date(lastActivityValue).toISOString(),
    certificate_triggered: Boolean(certificate)
  };
};

// ── Certificate triggering ─────────────────────────────────────────────────
const notifyCertificationService = async (userId: string, courseId: string): Promise<void> => {
  try {
    const response = await tracedFetch(
      'POST /certificates',
      'certification-service',
      `${CERTIFICATION_SERVICE_URL}/certificates`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, course_id: courseId })
      }
    );
    if (!response.ok) {
      logger.warn('certification-service rejected certificate request', {
        user_id: userId,
        course_id: courseId,
        status: response.status
      });
    }
  } catch (error) {
    logger.warn('failed to notify certification-service', {
      user_id: userId,
      course_id: courseId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

const publishCourseCompleted = async (userId: string, courseId: string): Promise<void> => {
  try {
    await redis.publish('course.completed', JSON.stringify({ userId, courseId }));
  } catch (error) {
    logger.warn('failed to publish course.completed to redis', {
      user_id: userId,
      course_id: courseId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

const runCompletionCheck = async (userId: string, courseId: string): Promise<void> => {
  const totalLessons = await getCourseLessonCount(courseId);
  if (totalLessons <= 0) {
    return;
  }

  const completedLessons = await countCompletedLessons(userId, courseId);
  if (completedLessons < totalLessons) {
    return;
  }

  const certificateRepository = AppDataSource.getRepository(CertificateIssue);
  const existing = await certificateRepository.findOne({ where: { userId, courseId } });
  if (existing) {
    return;
  }

  try {
    await certificateRepository.insert({ userId, courseId });
  } catch (error) {
    // The unique (userId, courseId) index dedupes concurrent completion
    // checks; losing the race simply means the certificate is already handled.
    logger.info('certificate issue insert skipped (already exists)', {
      user_id: userId,
      course_id: courseId,
      error: error instanceof Error ? error.message : String(error)
    });
    return;
  }

  certificatesTriggeredTotal.inc();
  logger.info('course completion detected, certificate triggered', {
    user_id: userId,
    course_id: courseId,
    completed_lessons: completedLessons,
    total_lessons: totalLessons
  });

  // Fire-and-forget: downstream failures are logged, never propagated.
  void notifyCertificationService(userId, courseId);
  void publishCourseCompleted(userId, courseId);
};

// ── Routes ─────────────────────────────────────────────────────────────────
router.post('/events', async (request, response, next) => {
  try {
    const {
      user_id: bodyUserId,
      course_id: courseId = null,
      lesson_id: lessonId = null,
      quiz_id: quizId = null,
      event_type: eventType,
      score = null
    } = request.body as {
      user_id?: string;
      course_id?: string | null;
      lesson_id?: string | null;
      quiz_id?: string | null;
      event_type?: string;
      score?: number | null;
    };

    const userId = bodyUserId ?? request.header('X-User-Id');
    if (!userId || typeof userId !== 'string') {
      return response.status(400).json({ error: 'user_id (or X-User-Id header) is required' });
    }

    if (!eventType || !TRACKING_EVENT_TYPES.includes(eventType)) {
      return response.status(400).json({
        error: `event_type must be one of: ${TRACKING_EVENT_TYPES.join(', ')}`
      });
    }

    if (score !== null && score !== undefined && typeof score !== 'number') {
      return response.status(400).json({ error: 'score must be a number' });
    }

    const repository = AppDataSource.getRepository(TrackingEvent);
    const event = await repository.save(
      repository.create({
        userId,
        courseId: courseId || null,
        lessonId: lessonId || null,
        quizId: quizId || null,
        eventType: eventType as TrackingEventType,
        score: score ?? null
      })
    );

    trackingEventsTotal.labels(eventType).inc();

    if (eventType === TrackingEventType.LESSON_COMPLETED && event.courseId) {
      // Downstream failures (content-service, certification-service, Redis)
      // must never fail event ingestion.
      try {
        await runCompletionCheck(userId, event.courseId);
      } catch (error) {
        logger.warn('completion check failed', {
          user_id: userId,
          course_id: event.courseId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return response.status(201).json({
      id: event.id,
      user_id: event.userId,
      course_id: event.courseId,
      lesson_id: event.lessonId,
      quiz_id: event.quizId,
      event_type: event.eventType,
      score: event.score,
      created_at: event.createdAt.toISOString()
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/users/:userId', async (request, response, next) => {
  try {
    const { userId } = request.params;

    const rows = await AppDataSource.getRepository(TrackingEvent)
      .createQueryBuilder('event')
      .select('DISTINCT event.courseId', 'courseId')
      .where('event.userId = :userId', { userId })
      .andWhere('event.courseId IS NOT NULL')
      .getRawMany<{ courseId: string }>();

    const courses = await Promise.all(rows.map((row) => buildCourseProgress(userId, row.courseId)));
    courses.sort((a, b) => (b.last_activity ?? '').localeCompare(a.last_activity ?? ''));

    return response.json({ user_id: userId, courses });
  } catch (error) {
    return next(error);
  }
});

router.get('/users/:userId/courses/:courseId', async (request, response, next) => {
  try {
    const { userId, courseId } = request.params;
    const progress = await buildCourseProgress(userId, courseId);
    return response.json(progress);
  } catch (error) {
    return next(error);
  }
});

router.get('/courses/:courseId/stats', async (request, response, next) => {
  try {
    const { courseId } = request.params;
    const eventRepository = AppDataSource.getRepository(TrackingEvent);

    const [learnersRow, completions, totalLessons, completedPerLearner] = await Promise.all([
      eventRepository
        .createQueryBuilder('event')
        .select('COUNT(DISTINCT event.userId)', 'learners')
        .where('event.courseId = :courseId', { courseId })
        .getRawOne<{ learners: string }>(),
      AppDataSource.getRepository(CertificateIssue).count({ where: { courseId } }),
      getCourseLessonCount(courseId),
      eventRepository
        .createQueryBuilder('event')
        .select('event.userId', 'userId')
        .addSelect('COUNT(DISTINCT event.lessonId)', 'completed')
        .where('event.courseId = :courseId', { courseId })
        .andWhere('event.eventType = :eventType', { eventType: TrackingEventType.LESSON_COMPLETED })
        .andWhere('event.lessonId IS NOT NULL')
        .groupBy('event.userId')
        .getRawMany<{ userId: string; completed: string }>()
    ]);

    const learners = Number(learnersRow?.learners ?? 0);

    let avgPercent = 0;
    if (learners > 0 && totalLessons > 0) {
      const totalPercent = completedPerLearner.reduce(
        (sum, row) => sum + Math.min(100, (Number(row.completed) / totalLessons) * 100),
        0
      );
      // Learners with events but no completed lessons contribute 0 percent.
      avgPercent = Number((totalPercent / learners).toFixed(2));
    }

    return response.json({
      course_id: courseId,
      learners,
      completions,
      avg_percent: avgPercent
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
