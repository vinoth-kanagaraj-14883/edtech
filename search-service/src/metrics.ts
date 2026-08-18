import type { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

export const register = new client.Registry();

register.setDefaultLabels({
  service: 'search-service'
});

client.collectDefaultMetrics({ register });

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register]
});

// Search-specific metrics: how often a query is served from the Redis hot
// cache vs. having to fall through to the course-service, plus the size of the
// warmed hot-course index. These make the "fast search" story observable in
// Grafana/Jaeger alongside the RED metrics.
export const searchCacheEvents = new client.Counter({
  name: 'search_cache_events_total',
  help: 'Search cache outcomes (hit/miss/bypass)',
  labelNames: ['result'] as const,
  registers: [register]
});

export const hotCourseIndexSize = new client.Gauge({
  name: 'search_hot_course_index_size',
  help: 'Number of hot courses currently warmed in the Redis index',
  registers: [register]
});

export const searchQueryDurationSeconds = new client.Histogram({
  name: 'search_query_duration_seconds',
  help: 'Time to satisfy a search query, split by data source',
  labelNames: ['source'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register]
});

const resolveRouteLabel = (request: Request): string => {
  const routePath = request.route?.path;

  if (typeof routePath === 'string') {
    return `${request.baseUrl}${routePath}` || routePath;
  }

  if (routePath instanceof RegExp) {
    return `${request.baseUrl}${routePath.source}`;
  }

  return request.baseUrl || request.path || 'unknown_route';
};

export const metricsMiddleware = (request: Request, response: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  response.on('finish', () => {
    const elapsedNanoseconds = process.hrtime.bigint() - start;
    const elapsedSeconds = Number(elapsedNanoseconds) / 1_000_000_000;
    const route = resolveRouteLabel(request);
    const statusCode = String(response.statusCode);

    httpRequestDurationSeconds.labels(request.method, route, statusCode).observe(elapsedSeconds);
    httpRequestsTotal.labels(request.method, route, statusCode).inc();
  });

  next();
};
