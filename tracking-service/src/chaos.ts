import { setTimeout as sleep } from 'node:timers/promises';

import { trace } from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';

import { logger } from './logger';

const SERVICE_NAME = 'tracking-service';

// Chaos flag contract: Redis string keys with a TTL, set by the chaos tooling.
const LATENCY_KEY = `chaos:latency:${SERVICE_NAME}`; // int milliseconds
const ERROR_KEY = `chaos:error:${SERVICE_NAME}`; // int percent 0-100
const CPU_KEY = `chaos:cpu:${SERVICE_NAME}`; // int busy-loop workers
const MEMLEAK_KEY = `chaos:memleak:${SERVICE_NAME}`; // int MB allocated per second

const POLL_INTERVAL_MS = 3_000;
const CHAOS_SKIP_PATHS = new Set(['/health', '/ready', '/metrics']);

const REDIS_URL = process.env.REDIS_URL ?? `redis://${process.env.REDIS_ADDR ?? 'redis:6379'}`;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

// Shared Redis client: chaos flag polling + pub/sub publishing. Redis is a
// soft dependency — the service must keep working when it is unavailable.
export const redis = new Redis(REDIS_URL, {
  password: REDIS_PASSWORD,
  lazyConnect: false,
  maxRetriesPerRequest: 2,
  enableReadyCheck: true
});

// ioredis emits an error event per failed reconnect attempt; throttle logging
// so a down Redis produces at most one log line per minute.
let lastRedisLogAt = 0;
const logRedisIssueThrottled = (message: string, error: unknown): void => {
  const now = Date.now();
  if (now - lastRedisLogAt < 60_000) {
    return;
  }
  lastRedisLogAt = now;
  logger.warn(message, {
    error: error instanceof Error ? error.message : String(error)
  });
};

redis.on('error', (error) => {
  logRedisIssueThrottled('redis unavailable (soft dependency, chaos flags fail-open)', error);
});

interface ChaosFlags {
  latencyMs: number;
  errorPercent: number;
  cpuWorkers: number;
  memleakMbPerSec: number;
}

let flags: ChaosFlags = { latencyMs: 0, errorPercent: 0, cpuWorkers: 0, memleakMbPerSec: 0 };

export const getChaosFlags = (): ChaosFlags => ({ ...flags });

const parseFlag = (raw: string | null | undefined): number => {
  if (raw === null || raw === undefined) {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

// ── CPU pressure workers ──────────────────────────────────────────────────
// Each worker spins the CPU for ~50ms, then yields with setImmediate so the
// event loop is degraded but never fully blocked forever. Bumping the
// generation retires all existing workers.
let cpuGeneration = 0;
let activeCpuWorkers = 0;

const startCpuWorker = (generation: number): void => {
  const spin = (): void => {
    if (generation !== cpuGeneration) {
      return;
    }
    const spinUntil = Date.now() + 50;
    let sink = 0;
    while (Date.now() < spinUntil) {
      sink += Math.sqrt(Math.random());
    }
    if (sink < 0) {
      // Unreachable; prevents the busy loop from being optimized away.
      logger.debug('cpu chaos sink', { sink });
    }
    setImmediate(spin);
  };
  setImmediate(spin);
};

const syncCpuWorkers = (target: number): void => {
  if (target === activeCpuWorkers) {
    return;
  }
  cpuGeneration += 1;
  activeCpuWorkers = target;
  for (let i = 0; i < target; i += 1) {
    startCpuWorker(cpuGeneration);
  }
  logger.info('chaos cpu workers updated', { workers: target });
};

// ── Memory-leak simulation ────────────────────────────────────────────────
// While the flag is set, allocate N MB every second into a retained global
// array; release everything as soon as the flag clears.
const leakedBuffers: Buffer[] = [];

const memleakTick = (): void => {
  if (flags.memleakMbPerSec > 0) {
    try {
      leakedBuffers.push(Buffer.alloc(flags.memleakMbPerSec * 1024 * 1024));
    } catch (error) {
      logger.warn('chaos memleak allocation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } else if (leakedBuffers.length > 0) {
    leakedBuffers.length = 0;
    logger.info('chaos memleak released retained buffers');
  }
};

// ── Flag polling ──────────────────────────────────────────────────────────
const pollFlags = async (): Promise<void> => {
  try {
    const values = await redis.mget(LATENCY_KEY, ERROR_KEY, CPU_KEY, MEMLEAK_KEY);
    flags = {
      latencyMs: parseFlag(values[0]),
      errorPercent: Math.min(100, parseFlag(values[1])),
      cpuWorkers: parseFlag(values[2]),
      memleakMbPerSec: parseFlag(values[3])
    };
  } catch (error) {
    // Fail-open: Redis down means no chaos is injected, never a crash.
    flags = { latencyMs: 0, errorPercent: 0, cpuWorkers: 0, memleakMbPerSec: 0 };
    logRedisIssueThrottled('chaos flag poll failed (fail-open, chaos disabled)', error);
  }

  syncCpuWorkers(flags.cpuWorkers);
};

let pollTimer: NodeJS.Timeout | undefined;
let memleakTimer: NodeJS.Timeout | undefined;

export const startChaosPolling = (): void => {
  if (pollTimer) {
    return;
  }
  void pollFlags();
  pollTimer = setInterval(() => void pollFlags(), POLL_INTERVAL_MS);
  memleakTimer = setInterval(memleakTick, 1_000);
  pollTimer.unref();
  memleakTimer.unref();
};

export const stopChaos = (): void => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
  if (memleakTimer) {
    clearInterval(memleakTimer);
    memleakTimer = undefined;
  }
  cpuGeneration += 1;
  activeCpuWorkers = 0;
  leakedBuffers.length = 0;
};

// ── Request middleware ────────────────────────────────────────────────────
export const chaosMiddleware = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  if (CHAOS_SKIP_PATHS.has(request.path)) {
    next();
    return;
  }

  const { latencyMs, errorPercent } = flags;

  if (latencyMs > 0) {
    // Jitter the delay instead of sleeping a constant amount: a flat delay is
    // obviously synthetic and collapses p50 onto p99, whereas a spread makes
    // the latency histogram look like a genuinely degraded dependency.
    const jittered = Math.round(latencyMs * (0.55 + Math.random() * 1.2));
    const span = trace.getActiveSpan();
    span?.setAttribute('chaos.injected', 'latency');
    span?.setAttribute('chaos.latency_ms', jittered);
    span?.setAttribute('chaos.latency_base_ms', latencyMs);
    await sleep(jittered);
  }

  if (errorPercent > 0 && Math.random() * 100 < errorPercent) {
    trace.getActiveSpan()?.setAttribute('chaos.injected', 'error');
    response.status(503).json({ error: 'chaos: injected failure', chaos: true });
    return;
  }

  next();
};
