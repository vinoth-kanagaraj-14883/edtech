"""Chaos flag contract for payment-service.

An external chaos-service sets Redis string keys (with TTLs). This module runs
a background asyncio poller that MGETs all keys every 3 seconds and caches the
values in memory, so the hot request path never touches Redis. Everything is
fail-open: if Redis is unreachable, all chaos flags are treated as inactive and
the poller keeps retrying quietly (it must never crash the service).

Keys polled:
    chaos:latency:payment-service  -> int ms of latency injected per request
    chaos:error:payment-service    -> int 0-100 percent of requests to fail
    chaos:cpu:payment-service      -> int busy-loop worker thread count
    chaos:memleak:payment-service  -> int MB/sec leaked while the flag is set
    chaos:payment-gateway:down     -> mock PSP outage flag (payment-service only)
"""

import asyncio
import random
import threading
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

import structlog
from opentelemetry import trace
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

logger = structlog.get_logger('payment-service.chaos')

SERVICE_NAME = 'payment-service'
POLL_INTERVAL_SECONDS = 3.0
SKIP_PATHS = {'/health', '/ready', '/metrics'}

LATENCY_KEY = f'chaos:latency:{SERVICE_NAME}'
ERROR_KEY = f'chaos:error:{SERVICE_NAME}'
CPU_KEY = f'chaos:cpu:{SERVICE_NAME}'
MEMLEAK_KEY = f'chaos:memleak:{SERVICE_NAME}'
PAYMENT_GATEWAY_DOWN_KEY = 'chaos:payment-gateway:down'
ALL_KEYS = [LATENCY_KEY, ERROR_KEY, CPU_KEY, MEMLEAK_KEY, PAYMENT_GATEWAY_DOWN_KEY]

_ONE_MEGABYTE = 1024 * 1024


def _to_int(raw: Any) -> int:
    if raw is None:
        return 0
    if isinstance(raw, bytes):
        raw = raw.decode('utf-8', errors='ignore')
    try:
        return max(0, int(str(raw).strip()))
    except (TypeError, ValueError):
        return 0


@dataclass
class ChaosState:
    latency_ms: int = 0
    error_percent: int = 0
    cpu_workers: int = 0
    memleak_mb_per_sec: int = 0
    payment_gateway_down: bool = False

    def reset(self) -> None:
        self.latency_ms = 0
        self.error_percent = 0
        self.cpu_workers = 0
        self.memleak_mb_per_sec = 0
        self.payment_gateway_down = False


def _busy_loop(stop_event: threading.Event) -> None:
    counter = 0
    while not stop_event.is_set():
        counter += 1
        _ = counter * counter
        if counter % 100_000 == 0:
            # Yield the GIL occasionally so the event loop keeps breathing.
            time.sleep(0)
        if counter >= 10_000_000:
            counter = 0


class ChaosPoller:
    """Background poller that mirrors the Redis chaos flags into memory."""

    def __init__(self, redis_client: Any, poll_interval: float = POLL_INTERVAL_SECONDS) -> None:
        self._redis = redis_client
        self._poll_interval = poll_interval
        self.state = ChaosState()
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()
        self._cpu_threads: list[threading.Thread] = []
        self._cpu_stop = threading.Event()
        self._leaked_memory: list[bytearray] = []
        self._redis_healthy = True

    async def start(self) -> None:
        if self._task is None:
            self._stop_event.clear()
            self._task = asyncio.create_task(self._run(), name='chaos-poller')
            logger.info('chaos_poller_started', keys=ALL_KEYS, interval_seconds=self._poll_interval)

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None
        self._apply_cpu_workers(0)
        self._leaked_memory.clear()
        logger.info('chaos_poller_stopped')

    async def _run(self) -> None:
        while not self._stop_event.is_set():
            await self._poll_once()
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._poll_interval)
            except asyncio.TimeoutError:
                continue

    async def _poll_once(self) -> None:
        try:
            values = await self._redis.mget(ALL_KEYS)
        except Exception as exc:
            # Fail open and stay quiet: no chaos while Redis is unreachable.
            if self._redis_healthy:
                logger.warning('chaos_poller_redis_unavailable', error=str(exc))
                self._redis_healthy = False
            self.state.reset()
            self._apply_cpu_workers(0)
            self._apply_memleak(0)
            return

        if not self._redis_healthy:
            logger.info('chaos_poller_redis_recovered')
            self._redis_healthy = True

        latency_raw, error_raw, cpu_raw, memleak_raw, gateway_raw = values
        self.state.latency_ms = _to_int(latency_raw)
        self.state.error_percent = min(100, _to_int(error_raw))
        self.state.cpu_workers = _to_int(cpu_raw)
        self.state.memleak_mb_per_sec = _to_int(memleak_raw)
        self.state.payment_gateway_down = gateway_raw is not None

        self._apply_cpu_workers(self.state.cpu_workers)
        self._apply_memleak(self.state.memleak_mb_per_sec)

    def _apply_cpu_workers(self, desired: int) -> None:
        alive = [thread for thread in self._cpu_threads if thread.is_alive()]
        if len(alive) == desired:
            return

        # Stop the current generation of busy-loop threads and start a fresh one.
        self._cpu_stop.set()
        self._cpu_stop = threading.Event()
        self._cpu_threads = []
        for index in range(desired):
            thread = threading.Thread(
                target=_busy_loop,
                args=(self._cpu_stop,),
                name=f'chaos-cpu-{index}',
                daemon=True,
            )
            thread.start()
            self._cpu_threads.append(thread)
        logger.info('chaos_cpu_workers_updated', workers=desired)

    def _apply_memleak(self, mb_per_sec: int) -> None:
        if mb_per_sec <= 0:
            if self._leaked_memory:
                self._leaked_memory.clear()
                logger.info('chaos_memleak_cleared')
            return
        # The poller ticks every poll_interval seconds, so leak
        # mb_per_sec * poll_interval MB per tick to approximate MB/sec.
        chunk_size = int(mb_per_sec * self._poll_interval * _ONE_MEGABYTE)
        self._leaked_memory.append(bytearray(chunk_size))
        logger.info(
            'chaos_memleak_tick',
            mb_per_sec=mb_per_sec,
            leaked_total_mb=sum(len(chunk) for chunk in self._leaked_memory) // _ONE_MEGABYTE,
        )


async def apply_chaos(
    poller: ChaosPoller,
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """HTTP middleware body implementing latency and error injection."""
    if request.url.path in SKIP_PATHS:
        return await call_next(request)

    state = poller.state

    if state.latency_ms > 0:
        # Apply log-normal-ish jitter around the configured latency. A constant
        # delay is a dead giveaway that the slowdown is synthetic; real degraded
        # dependencies produce a spread, which is also what makes p50 vs p99
        # diverge the way an operator expects to see on a latency dashboard.
        delay_ms = state.latency_ms * random.uniform(0.55, 1.75)
        span = trace.get_current_span()
        if span is not None:
            span.set_attribute('chaos.injected', 'latency')
            span.set_attribute('chaos.latency_ms', round(delay_ms, 1))
            span.set_attribute('chaos.latency_base_ms', state.latency_ms)
        await asyncio.sleep(delay_ms / 1000)

    if state.error_percent > 0 and random.random() * 100 < state.error_percent:
        span = trace.get_current_span()
        if span is not None:
            span.set_attribute('chaos.injected', 'error')
        logger.warning(
            'chaos_error_injected',
            method=request.method,
            path=request.url.path,
            error_percent=state.error_percent,
        )
        return JSONResponse(
            status_code=503,
            content={'error': 'chaos: injected failure', 'chaos': True},
        )

    return await call_next(request)
