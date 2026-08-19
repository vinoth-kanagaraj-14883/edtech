import './tracing';

import 'dotenv/config';

import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { chaosMiddleware, redis, startChaosPolling, stopChaos } from './chaos';
import { AppDataSource } from './database';
import { logger } from './logger';
import { metricsMiddleware, register } from './metrics';
import trackingRouter from './routes/tracking';
import { shutdownTracing } from './tracing';

const app = express();
const port = Number(process.env.PORT ?? 8008);
const host = process.env.HOST ?? '0.0.0.0';

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use((request, response, next) => {
  response.setHeader('X-Request-Id', request.header('X-Request-Id') ?? uuidv4());
  next();
});
app.use(metricsMiddleware);
app.use((request, response, next) => {
  const startedAt = process.hrtime.bigint();

  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info('request completed', {
      request_id: response.getHeader('X-Request-Id'),
      method: request.method,
      route: request.baseUrl || request.path,
      status_code: response.statusCode,
      duration_ms: Number(durationMs.toFixed(3)),
      remote_ip: request.ip,
      user_agent: request.get('user-agent') ?? null
    });
  });

  next();
});
// Chaos fault injection (latency / errors) — skips /health, /ready, /metrics.
app.use((request, response, next) => {
  void chaosMiddleware(request, response, next).catch(next);
});

app.get('/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'tracking-service',
    uptimeSeconds: Number(process.uptime().toFixed(0))
  });
});

app.get('/ready', async (_request, response) => {
  if (!AppDataSource.isInitialized) {
    return response.status(503).json({ status: 'not_ready', checks: { database: 'not_initialized' } });
  }

  try {
    await AppDataSource.query('SELECT 1');
    return response.status(200).json({ status: 'ready', checks: { database: 'ok' } });
  } catch (error) {
    logger.error('readiness probe failed', { error });
    return response.status(503).json({ status: 'not_ready', checks: { database: 'error' } });
  }
});

app.get('/metrics', async (_request, response, next) => {
  try {
    response.setHeader('Content-Type', register.contentType);
    response.end(await register.metrics());
  } catch (error) {
    next(error);
  }
});

app.use('/tracking', trackingRouter);

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.use((error: Error, request: Request, response: Response, _next: NextFunction) => {
  const statusCode = /valid|required|integer|must be/.test(error.message) ? 400 : 500;
  logger.error('request failed', {
    request_id: response.getHeader('X-Request-Id'),
    method: request.method,
    path: request.originalUrl,
    status_code: statusCode,
    error: error.message,
    stack: error.stack
  });

  response.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : error.message
  });
});

let shuttingDown = false;

const shutdown = async (signal: string, server?: ReturnType<typeof app.listen>): Promise<void> => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info('shutting down service', { signal });

  stopChaos();

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  await Promise.allSettled([redis.quit()]);
  await shutdownTracing();
};

const bootstrap = async (): Promise<void> => {
  await AppDataSource.initialize();
  logger.info('database connection initialized', {
    host: process.env.DB_HOST ?? 'mysql',
    database: process.env.DB_NAME ?? 'trackingdb'
  });

  // Redis is a soft dependency: chaos polling fails open when it is down.
  startChaosPolling();

  const server = app.listen(port, host, () => {
    logger.info('tracking service started', { host, port });
  });

  const handleSignal = (signal: NodeJS.Signals) => {
    void shutdown(signal, server)
      .then(() => process.exit(0))
      .catch((error: Error) => {
        logger.error('graceful shutdown failed', { error: error.message, stack: error.stack });
        process.exit(1);
      });
  };

  process.on('SIGTERM', handleSignal);
  process.on('SIGINT', handleSignal);
  process.on('uncaughtException', (error) => {
    logger.error('uncaught exception', { error: error.message, stack: error.stack });
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason)
    });
  });
};

void bootstrap().catch((error: Error) => {
  logger.error('failed to start tracking service', { error: error.message, stack: error.stack });
  void shutdown('bootstrap_failure').finally(() => process.exit(1));
});
