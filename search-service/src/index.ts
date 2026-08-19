// OpenTelemetry must be initialized before any other imports so auto
// instrumentation can patch http/express/ioredis.
import './tracing';

import { setTimeout as sleep } from 'node:timers/promises';

import { context, propagation, SpanStatusCode, trace } from '@opentelemetry/api';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import Redis from 'ioredis';

import { chaosMiddleware, startChaosPolling, stopChaos } from './chaos';
import {
  hotCourseIndexSize,
  metricsMiddleware,
  register,
  searchCacheEvents,
  searchQueryDurationSeconds
} from './metrics';
import { shutdownTracing } from './tracing';

const PORT = Number(process.env.PORT ?? 8006);
const COURSE_SERVICE_URL = (process.env.COURSE_SERVICE_URL ?? 'http://course-service:8002').replace(/\/$/, '');
const REDIS_URL = process.env.REDIS_URL ?? `redis://${process.env.REDIS_ADDR ?? 'redis:6379'}`;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

// How often to refresh the "hot courses" index from the course-service, and
// how many top courses to keep hot. The hot set is what makes search fast:
// popular queries are answered entirely from Redis without touching the DB.
const HOT_REFRESH_MS = Number(process.env.HOT_REFRESH_MS ?? 60_000);
const HOT_COURSE_LIMIT = Number(process.env.HOT_COURSE_LIMIT ?? 500);
// TTL for cached per-query result payloads.
const RESULT_CACHE_TTL_SEC = Number(process.env.RESULT_CACHE_TTL_SEC ?? 60);

const HOT_INDEX_KEY = 'search:hot:courses';
const RESULT_CACHE_PREFIX = 'search:result:';

interface Course {
  id: string;
  title: string;
  description?: string;
  level?: string;
  price?: number;
  durationHours?: number;
  thumbnailUrl?: string;
  tags?: string[];
  [key: string]: unknown;
}

const redis = new Redis(REDIS_URL, {
  password: REDIS_PASSWORD,
  lazyConnect: false,
  maxRetriesPerRequest: 2,
  enableReadyCheck: true
});

redis.on('error', (err) => {
  // Non-fatal: search falls back to course-service when Redis is unavailable.
  console.error(JSON.stringify({ level: 'error', service: 'search-service', msg: 'redis error', error: err.message }));
});

const log = (level: string, msg: string, extra: Record<string, unknown> = {}): void => {
  console.log(JSON.stringify({ level, service: 'search-service', timestamp: new Date().toISOString(), msg, ...extra }));
};

// ── Hot-course index ─────────────────────────────────────────────────────
// An in-process copy of the hot courses for the fastest possible filtering,
// mirrored into Redis so the warmed set survives restarts and can be shared.
let hotCourses: Course[] = [];

async function fetchCoursesFromService(params: Record<string, string>): Promise<{ courses: Course[]; total: number }> {
  const qs = new URLSearchParams(params).toString();
  const url = `${COURSE_SERVICE_URL}/courses${qs ? `?${qs}` : ''}`;

  // Explicitly inject the active trace context (W3C traceparent/tracestate)
  // into the outbound headers. Node's base http/https auto-instrumentation
  // does NOT patch the global `fetch` (undici) client, so relying on it alone
  // would break the trace chain and leave course-service as a disconnected
  // root trace — invisible as a downstream edge in Jaeger's dependency graph.
  // Injecting here is idempotent even if undici instrumentation is also active.
  const headers: Record<string, string> = { Accept: 'application/json' };
  propagation.inject(context.active(), headers);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`course-service responded ${res.status}`);
  }
  const body = (await res.json()) as { courses?: Course[]; totalElements?: number };
  return { courses: body.courses ?? [], total: body.totalElements ?? (body.courses?.length ?? 0) };
}

async function refreshHotCourses(): Promise<void> {
  // The refresh runs on a background timer with no inbound request context, so
  // start a dedicated root span. This gives the periodic course-service call a
  // named trace (instead of an anonymous orphan) and, combined with the
  // context injection in fetchCoursesFromService, makes search-service →
  // course-service show up as an edge in Jaeger's System Architecture graph.
  const tracer = trace.getTracer('search-service');
  const span = tracer.startSpan('refreshHotCourses');
  try {
    await context.with(trace.setSpan(context.active(), span), async () => {
      // Pull the top slice of published courses to keep hot.
      const { courses } = await fetchCoursesFromService({
        status: 'PUBLISHED',
        size: String(HOT_COURSE_LIMIT),
        page: '0'
      });
      hotCourses = courses;
      hotCourseIndexSize.set(courses.length);

      // Mirror into Redis (best-effort) so a cold restart can serve immediately.
      try {
        await redis.set(HOT_INDEX_KEY, JSON.stringify(courses), 'EX', HOT_REFRESH_MS / 1000 + 30);
      } catch {
        /* Redis optional */
      }
      log('info', 'hot course index refreshed', { count: courses.length });
    });
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    log('warn', 'failed to refresh hot courses', { error: (error as Error).message });
  } finally {
    span.end();
  }
}

async function loadHotFromRedis(): Promise<void> {
  try {
    const raw = await redis.get(HOT_INDEX_KEY);
    if (raw) {
      hotCourses = JSON.parse(raw) as Course[];
      hotCourseIndexSize.set(hotCourses.length);
    }
  } catch {
    /* ignore — will be populated by refresh loop */
  }
}

// Filter the hot in-memory set by free-text query + optional level.
function searchHot(query: string, level?: string): Course[] {
  const q = query.trim().toLowerCase();
  return hotCourses.filter((course) => {
    if (level && String(course.level).toUpperCase() !== level.toUpperCase()) {
      return false;
    }
    if (!q) {
      return true;
    }
    const haystack = [
      course.title,
      course.description,
      ...(course.tags ?? [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

function resultCacheKey(query: string, level: string, page: number, size: number): string {
  return `${RESULT_CACHE_PREFIX}${level}:${page}:${size}:${query.trim().toLowerCase()}`;
}

// ── App ────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);
// Honor Redis chaos flags (skips /health,/ready,/metrics internally) so the
// chaos-service can degrade this service during observability demos.
app.use(chaosMiddleware);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'search-service', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await redis.ping();
    res.json({ status: 'ready', service: 'search-service' });
  } catch (error) {
    // Redis is a soft dependency; report ready as long as we can still fall
    // back to course-service. But signal degraded state in the body.
    res.json({ status: 'ready', service: 'search-service', redis: 'unavailable', detail: (error as Error).message });
  }
});

app.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Primary search endpoint. Tries: (1) Redis result cache, (2) hot in-memory
// index, (3) course-service fallback — recording which source served it.
const handleSearch = async (req: Request, res: Response): Promise<void> => {
  const query = String(req.query.q ?? req.query.search ?? '');
  const level = req.query.level ? String(req.query.level).toUpperCase() : '';
  const page = Math.max(0, Number(req.query.page ?? 0) || 0);
  const size = Math.min(100, Math.max(1, Number(req.query.size ?? 20) || 20));

  const stop = searchQueryDurationSeconds.startTimer();

  // 1. Result cache
  const cacheKey = resultCacheKey(query, level, page, size);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      searchCacheEvents.labels('hit').inc();
      stop({ source: 'cache' });
      res.set('X-Search-Source', 'cache');
      res.json(JSON.parse(cached));
      return;
    }
  } catch {
    /* fall through */
  }

  // 2. Hot in-memory index
  if (hotCourses.length > 0) {
    const matches = searchHot(query, level);
    if (matches.length > 0 || query.trim() !== '') {
      const start = page * size;
      const pageItems = matches.slice(start, start + size);
      const payload = {
        courses: pageItems,
        totalElements: matches.length,
        totalPages: Math.ceil(matches.length / size),
        page,
        size,
        source: 'hot'
      };
      searchCacheEvents.labels('hot').inc();
      stop({ source: 'hot' });
      res.set('X-Search-Source', 'hot');
      res.json(payload);
      // Warm the result cache for next time (best-effort).
      redis.set(cacheKey, JSON.stringify(payload), 'EX', RESULT_CACHE_TTL_SEC).catch(() => undefined);
      return;
    }
  }

  // 3. Fallback to course-service (authoritative search over the full catalog)
  try {
    searchCacheEvents.labels('miss').inc();
    const params: Record<string, string> = { search: query, size: String(size), page: String(page) };
    if (level) {
      params.level = level;
    }
    const { courses, total } = await fetchCoursesFromService(params);
    const payload = {
      courses,
      totalElements: total,
      totalPages: Math.ceil(total / size),
      page,
      size,
      source: 'course-service'
    };
    stop({ source: 'course-service' });
    res.set('X-Search-Source', 'course-service');
    res.json(payload);
    redis.set(cacheKey, JSON.stringify(payload), 'EX', RESULT_CACHE_TTL_SEC).catch(() => undefined);
  } catch (error) {
    stop({ source: 'error' });
    log('error', 'search fallback failed', { error: (error as Error).message });
    res.status(502).json({ error: 'search_unavailable', message: (error as Error).message });
  }
};

app.get('/search', handleSearch);
// Alias so the gateway can also route /courses/search style paths here.
app.get('/search/courses', handleSearch);

// ── Bootstrap ─────────────────────────────────────────────────────────────
let refreshTimer: NodeJS.Timeout | undefined;

async function start(): Promise<void> {
  await loadHotFromRedis();
  // Kick off an initial warm (don't block startup if course-service is slow).
  void refreshHotCourses();
  refreshTimer = setInterval(() => void refreshHotCourses(), HOT_REFRESH_MS);

  const server = app.listen(PORT, () => {
    log('info', 'search-service listening', { port: PORT, courseService: COURSE_SERVICE_URL });
  });

  const shutdown = async (signal: string): Promise<void> => {
    log('info', 'shutting down', { signal });
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    server.close();
    await Promise.allSettled([redis.quit(), shutdownTracing()]);
    // Give in-flight requests a moment to drain.
    await sleep(200);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void start();
