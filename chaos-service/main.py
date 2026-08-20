"""EduForge chaos-service.

A dedicated chaos server on its own port (default 8090) that creates faults in
the EduForge platform for observability demos. It has two levers:

* Application faults are injected by setting Redis chaos flags that every service
  already polls (latency / error-rate / CPU / memory-leak). Works everywhere.
* Kubernetes faults (pod-kill, CPU/memory stress, network partition, bad rollout)
  are driven through the Kubernetes API and degrade gracefully with no cluster.

Exposes a JSON API and a self-contained web dashboard so an operator can start a
scenario, watch it surface in Jaeger / Prometheus / Grafana, then stop it.
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse, JSONResponse
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.composite import CompositePropagator
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.baggage.propagation import W3CBaggagePropagator
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, generate_latest
from pydantic_settings import BaseSettings, SettingsConfigDict

from dashboard import render_dashboard
from docker_chaos import DockerChaos
from engine import INTENSITY_PRESETS, ChaosEngine
from k8s_chaos import KubeChaos
from scenarios import (
    ALL_SCENARIOS,
    DEFAULT_FLAG_TTL_SECONDS,
    PLAYBOOKS,
    PLAYBOOKS_BY_NAME,
    SCENARIOS_BY_NAME,
)

CHAOS_KEY_PREFIX = "chaos:"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore", case_sensitive=False)

    service_name: str = "chaos-service"
    environment: str = "production"
    chaos_port: int = 8090
    redis_addr: str = "redis:6379"
    redis_password: str = ""
    kube_namespace: str = "edtech"
    flag_ttl_seconds: int = DEFAULT_FLAG_TTL_SECONDS
    otel_exporter_otlp_endpoint: str = "otel-collector:4317"
    otlp_endpoint: str | None = None

    @property
    def otlp_collector_endpoint(self) -> str:
        return self.otlp_endpoint or self.otel_exporter_otlp_endpoint


settings = Settings()


def add_trace_context(_: Any, __: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    span = trace.get_current_span()
    span_context = span.get_span_context() if span else None
    event_dict["service"] = settings.service_name
    if span_context and span_context.is_valid:
        event_dict["trace_id"] = format(span_context.trace_id, "032x")
        event_dict["span_id"] = format(span_context.span_id, "016x")
    return event_dict


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso", utc=True, key="timestamp"),
            structlog.stdlib.add_log_level,
            add_trace_context,
            structlog.processors.EventRenamer("message"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


configure_logging()
logger = structlog.get_logger(settings.service_name)

request_counter = Counter(
    "chaos_service_http_requests_total",
    "Total HTTP requests handled by the chaos service",
    ["method", "route", "status"],
)
active_scenarios_gauge = Gauge(
    "chaos_service_active_scenarios",
    "Number of chaos scenarios currently active",
)
scenario_runs_counter = Counter(
    "chaos_service_scenario_runs_total",
    "Chaos scenario start/stop actions by result",
    ["scenario", "action", "result"],
)

auto_mode_gauge = Gauge(
    "chaos_service_auto_mode_enabled",
    "1 when chaos auto mode (chaos monkey) is running, 0 otherwise",
)

# Per-scenario active flag. This is what makes chaos visible on the Grafana
# dashboards: an annotation query of `chaos_scenario_active > 0` draws a labelled
# region over every latency/error panel, so a spike can be attributed to a
# specific injected fault instead of being guessed at.
scenario_active_gauge = Gauge(
    "chaos_scenario_active",
    "1 while a named chaos scenario is active, 0 once it has been cleared",
    ["scenario", "category", "target"],
)

fastapi_instrumentor = FastAPIInstrumentor()

# In-memory record of active scenarios: name -> {params, faults/action, startedAt}.
ACTIVE: dict[str, dict[str, Any]] = {}

# Populated in the lifespan once the Redis client and Kubernetes handle exist.
ENGINE: ChaosEngine | None = None


def get_engine() -> ChaosEngine:
    if ENGINE is None:  # pragma: no cover - only before startup completes
        raise HTTPException(status_code=503, detail="chaos engine not started yet")
    return ENGINE


def configure_telemetry(app: FastAPI) -> TracerProvider | None:
    try:
        resource = Resource.create(
            {"service.name": settings.service_name, "deployment.environment": settings.environment}
        )
        tracer_provider = TracerProvider(resource=resource)
        tracer_provider.add_span_processor(
            BatchSpanProcessor(
                OTLPSpanExporter(endpoint=settings.otlp_collector_endpoint, insecure=True)
            )
        )
        trace.set_tracer_provider(tracer_provider)
        set_global_textmap(
            CompositePropagator([TraceContextTextMapPropagator(), W3CBaggagePropagator()])
        )
        fastapi_instrumentor.instrument_app(
            app, tracer_provider=tracer_provider, excluded_urls="/health,/ready,/metrics"
        )
        app.state.tracer_provider = tracer_provider
        return tracer_provider
    except Exception as exc:  # pragma: no cover - telemetry must never block startup
        logger.warning("telemetry_init_failed", error=str(exc))
        return None


def create_redis_client() -> aioredis.Redis:
    host, _, port = settings.redis_addr.partition(":")
    return aioredis.Redis(
        host=host or "redis",
        port=int(port) if port else 6379,
        password=settings.redis_password or None,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ENGINE
    logger.info("service_starting", port=settings.chaos_port)
    app.state.redis = create_redis_client()
    app.state.kube = KubeChaos(settings.kube_namespace)
    app.state.docker = DockerChaos()

    ENGINE = ChaosEngine(starter=_start_scenario, stopper=_stop_scenario, clock=time.time)
    ENGINE.configure_auto_pool(ALL_SCENARIOS)
    app.state.engine = ENGINE
    ENGINE.record("info", "chaos-service ready")
    auto_mode_gauge.set(0)

    logger.info(
        "service_started",
        kubernetes_available=app.state.kube.available,
        kubernetes_reason=app.state.kube.reason,
        docker_available=app.state.docker.available,
        docker_reason=app.state.docker.reason,
    )
    try:
        yield
    finally:
        logger.info("service_shutting_down")
        if ENGINE is not None:
            await ENGINE.shutdown()
        try:
            app.state.docker.close()
        except Exception:
            pass
        try:
            await app.state.redis.aclose()
        except Exception:
            pass
        fastapi_instrumentor.uninstrument_app(app)
        tp = getattr(app.state, "tracer_provider", None)
        if tp is not None:
            tp.shutdown()
        logger.info("service_stopped")


app = FastAPI(title="EduForge Chaos Service", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        route = request.scope.get("route")
        path = getattr(route, "path", request.url.path)
        request_counter.labels(request.method, path, str(status_code)).inc()
        active_scenarios_gauge.set(len(ACTIVE))
        _ = time.perf_counter() - start


configure_telemetry(app)


# ── Helpers ──────────────────────────────────────────────────────────────────
def _scenario_or_404(name: str):
    scenario = SCENARIOS_BY_NAME.get(name)
    if scenario is None:
        raise HTTPException(status_code=404, detail=f"unknown scenario: {name}")
    return scenario


async def _set_app_faults(redis: aioredis.Redis, faults, ttl: int) -> list[str]:
    keys: list[str] = []
    pipe = redis.pipeline()
    for fault in faults:
        pipe.set(fault.key, fault.value, ex=ttl)
        keys.append(fault.key)
    await pipe.execute()
    return keys


async def _clear_keys(redis: aioredis.Redis, keys) -> None:
    if keys:
        await redis.delete(*keys)


# ── Routes ───────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def dashboard() -> HTMLResponse:
    return HTMLResponse(
        render_dashboard(
            [s.to_public() for s in ALL_SCENARIOS],
            [p.to_public() for p in PLAYBOOKS],
        )
    )


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "service": settings.service_name, "timestamp": time.time()}


@app.get("/ready")
async def ready(request: Request) -> JSONResponse:
    detail: dict[str, Any] = {"service": settings.service_name}
    try:
        await request.app.state.redis.ping()
        detail["redis"] = "ok"
        code = 200
    except Exception as exc:
        detail["redis"] = f"unavailable: {exc}"
        code = 503
    detail["kubernetes"] = request.app.state.kube.reason
    detail["status"] = "ready" if code == 200 else "degraded"
    return JSONResponse(status_code=code, content=detail)


@app.get("/metrics")
async def metrics() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/scenarios")
async def list_scenarios() -> dict[str, Any]:
    return {
        "scenarios": [s.to_public() for s in ALL_SCENARIOS],
        "active": list(ACTIVE.keys()),
        "kubernetesAvailable": app.state.kube.available,
        "dockerAvailable": app.state.docker.available,
        "dockerTargets": app.state.docker.list_targets(),
    }


# ── Core start/stop, shared by the HTTP routes and the ChaosEngine ───────────
async def _start_scenario(name: str, params: dict[str, Any]) -> dict[str, Any]:
    """Start a scenario. Returns a JSON-able result dict (never raises for
    Kubernetes failures — those come back as ok=False)."""
    scenario = _scenario_or_404(name)
    ttl = int(params.get("ttl", settings.flag_ttl_seconds))
    duration = float(params.get("duration", 0) or 0)
    engine = ENGINE

    if scenario.category == "application":
        magnitude = int(params.get("magnitude", scenario.default_magnitude))
        faults = scenario.build_faults(magnitude)
        # The Redis TTL is a fail-safe; make sure it always outlives an
        # explicitly requested duration so the flag cannot expire mid-experiment.
        effective_ttl = max(ttl, int(duration) + 30) if duration else ttl
        keys = await _set_app_faults(app.state.redis, faults, effective_ttl)
        ACTIVE[name] = {
            "category": "application",
            "magnitude": magnitude,
            "unit": scenario.magnitude_unit,
            "keys": keys,
            "ttl": effective_ttl,
            "startedAt": time.time(),
            "target": scenario.target_service,
        }
        scenario_runs_counter.labels(name, "start", "ok").inc()
        active_scenarios_gauge.set(len(ACTIVE))
        scenario_active_gauge.labels(name, "application", scenario.target_service).set(1)
        if engine is not None:
            engine.schedule_expiry(name, duration)
            engine.record(
                "started",
                f"{scenario.title} → {magnitude} {scenario.magnitude_unit}",
                name,
                target=scenario.target_service,
                duration=int(duration) or None,
            )
        logger.info("scenario_started", scenario=name, magnitude=magnitude, keys=keys, ttl=effective_ttl)
        return {
            "ok": True,
            "scenario": name,
            "category": "application",
            "message": f"set {len(keys)} chaos flag(s) with TTL {effective_ttl}s",
            "flags": {k: True for k in keys},
            "magnitude": magnitude,
            "durationSeconds": int(duration) or None,
            "howItShows": scenario.how_it_shows,
        }

    # docker / kubernetes — infrastructure backends
    target = params.get("target") or scenario.default_target_workload or scenario.target_service
    if scenario.category == "docker":
        backend, action = app.state.docker, scenario.docker_action
    else:
        backend, action = app.state.kube, scenario.kube_action

    result = backend.start(action, target, params)
    outcome = "ok" if result.get("ok") else "error"
    scenario_runs_counter.labels(name, "start", outcome).inc()
    if result.get("ok"):
        ACTIVE[name] = {
            "category": scenario.category,
            "action": action,
            "target": target,
            "params": params,
            "magnitude": params.get("magnitude"),
            "unit": scenario.magnitude_unit,
            "startedAt": time.time(),
        }
        active_scenarios_gauge.set(len(ACTIVE))
        scenario_active_gauge.labels(name, scenario.category, target).set(1)
        if engine is not None:
            engine.schedule_expiry(name, duration)
            engine.record("started", f"{scenario.title} → {target}", name, target=target)
    elif engine is not None:
        engine.record("error", f"{scenario.title} failed: {result.get('message')}", name)
    logger.info("scenario_started", scenario=name, target=target, result=result)
    return {
        "ok": result.get("ok", False),
        "scenario": name,
        "category": scenario.category,
        "target": target,
        "message": result.get("message"),
        "durationSeconds": int(duration) or None,
        "howItShows": scenario.how_it_shows,
    }


async def _stop_scenario(name: str, _params: dict[str, Any]) -> dict[str, Any]:
    scenario = _scenario_or_404(name)
    record = ACTIVE.get(name)
    engine = ENGINE
    if engine is not None:
        engine.cancel_expiry(name)

    if scenario.category == "application":
        # Clear whatever keys we set (fall back to a fresh build if we lost state).
        keys = record.get("keys") if record else [f.key for f in scenario.build_faults(scenario.default_magnitude)]
        await _clear_keys(app.state.redis, keys)
        was_active = ACTIVE.pop(name, None) is not None
        scenario_runs_counter.labels(name, "stop", "ok").inc()
        active_scenarios_gauge.set(len(ACTIVE))
        scenario_active_gauge.labels(name, "application", scenario.target_service).set(0)
        if engine is not None and was_active:
            engine.record("stopped", f"{scenario.title} cleared", name)
        logger.info("scenario_stopped", scenario=name, keys=keys)
        return {"ok": True, "scenario": name, "message": f"cleared {len(keys)} flag(s)"}

    target = (record or {}).get("target") or scenario.default_target_workload or scenario.target_service
    if scenario.category == "docker":
        backend, action = app.state.docker, scenario.docker_action
    else:
        backend, action = app.state.kube, scenario.kube_action

    result = backend.stop(action, target, (record or {}).get("params", {}))
    was_active = ACTIVE.pop(name, None) is not None
    scenario_runs_counter.labels(name, "stop", "ok" if result.get("ok") else "error").inc()
    active_scenarios_gauge.set(len(ACTIVE))
    scenario_active_gauge.labels(name, scenario.category, target).set(0)
    if engine is not None and was_active:
        engine.record("stopped", f"{scenario.title} reverted", name)
    logger.info("scenario_stopped", scenario=name, target=target, result=result)
    return {"ok": result.get("ok", False), "scenario": name, "message": result.get("message")}


@app.post("/scenarios/{name}/start")
async def start_scenario(name: str, request: Request) -> JSONResponse:
    params = await _read_json(request)
    result = await _start_scenario(name, params)
    return JSONResponse(status_code=200 if result.get("ok") else 503, content=result)


@app.post("/scenarios/{name}/stop")
async def stop_scenario(name: str, request: Request) -> JSONResponse:
    scenario = _scenario_or_404(name)
    record = ACTIVE.get(name)

    if scenario.category == "application":
        result = await _stop_scenario(name, {})
        return JSONResponse(result)

    result = await _stop_scenario(name, {})
    return JSONResponse(content=result)


@app.get("/status")
async def chaos_status(request: Request) -> dict[str, Any]:
    redis = request.app.state.redis
    engine = ENGINE
    live_flags: dict[str, Any] = {}
    redis_ok = True
    try:
        keys = await redis.keys(f"{CHAOS_KEY_PREFIX}*")
        for key in keys:
            value = await redis.get(key)
            ttl = await redis.ttl(key)
            live_flags[key] = {"value": value, "ttl": ttl}
    except Exception as exc:
        redis_ok = False
        live_flags = {"error": f"redis unavailable: {exc}"}

    # Decorate active scenarios with live countdowns so the UI can tick them.
    now = time.time()
    active: dict[str, Any] = {}
    for name, record in ACTIVE.items():
        scenario = SCENARIOS_BY_NAME.get(name)
        entry = dict(record)
        entry["elapsedSeconds"] = round(now - record.get("startedAt", now), 1)
        entry["title"] = scenario.title if scenario else name
        entry["blastRadius"] = scenario.blast_radius if scenario else ""
        if engine is not None:
            remaining = engine.remaining_seconds(name)
            entry["remainingSeconds"] = round(remaining, 1) if remaining is not None else None
        active[name] = entry

    return {
        "active": active,
        "liveRedisFlags": live_flags,
        "redisOk": redis_ok,
        "kubernetes": request.app.state.kube.status(),
        "docker": request.app.state.docker.status(),
        "auto": {
            "enabled": engine.auto_enabled if engine else False,
            "intensity": engine.auto_intensity if engine else None,
            "intensities": list(INTENSITY_PRESETS.keys()),
        },
        "playbook": engine.playbook_state if engine else {},
        "latestEventSeq": engine.events.latest_seq if engine else 0,
        "serverTime": now,
    }


@app.get("/events")
async def chaos_events(after: int = 0, limit: int = 100) -> dict[str, Any]:
    """Incremental event feed. Pass `after` = the last seq you saw."""
    engine = get_engine()
    return {"events": engine.events.since(after, limit), "latestSeq": engine.events.latest_seq}


# ── Auto mode (chaos monkey) ─────────────────────────────────────────────────
@app.post("/auto/start")
async def auto_start(request: Request) -> dict[str, Any]:
    engine = get_engine()
    params = await _read_json(request)
    intensity = str(params.get("intensity", "normal"))
    await engine.start_auto(intensity, lambda: list(ACTIVE.keys()))
    auto_mode_gauge.set(1)
    return {
        "ok": True,
        "enabled": True,
        "intensity": engine.auto_intensity,
        "message": f"auto mode running at {engine.auto_intensity} intensity",
    }


@app.post("/auto/stop")
async def auto_stop() -> dict[str, Any]:
    engine = get_engine()
    await engine.stop_auto()
    auto_mode_gauge.set(0)
    return {"ok": True, "enabled": False, "message": "auto mode stopped"}


# ── Playbooks (game days) ────────────────────────────────────────────────────
@app.get("/playbooks")
async def list_playbooks() -> dict[str, Any]:
    engine = ENGINE
    return {
        "playbooks": [p.to_public() for p in PLAYBOOKS],
        "running": engine.playbook_state if engine else {},
    }


@app.post("/playbooks/{name}/run")
async def run_playbook(name: str) -> JSONResponse:
    engine = get_engine()
    playbook = PLAYBOOKS_BY_NAME.get(name)
    if playbook is None:
        raise HTTPException(status_code=404, detail=f"unknown playbook: {name}")
    try:
        await engine.run_playbook(playbook)
    except RuntimeError as exc:
        return JSONResponse(status_code=409, content={"ok": False, "message": str(exc)})
    return JSONResponse(
        {
            "ok": True,
            "playbook": name,
            "message": f"{playbook.title} started — {len(playbook.steps)} steps over ~{int(playbook.total_seconds)}s",
            "whatToWatch": playbook.what_to_watch,
        }
    )


@app.post("/playbooks/cancel")
async def cancel_playbook() -> dict[str, Any]:
    engine = get_engine()
    await engine.cancel_playbook()
    return {"ok": True, "message": "playbook cancelled and faults cleared"}


@app.post("/reset")
async def reset_all(request: Request) -> dict[str, Any]:
    redis = request.app.state.redis
    engine = ENGINE
    if engine is not None:
        await engine.stop_auto()
        await engine.cancel_playbook()
        for name in list(ACTIVE.keys()):
            engine.cancel_expiry(name)
    auto_mode_gauge.set(0)

    cleared = 0
    try:
        keys = await redis.keys(f"{CHAOS_KEY_PREFIX}*")
        if keys:
            cleared = await redis.delete(*keys)
    except Exception as exc:
        logger.warning("reset_redis_failed", error=str(exc))
    kube_results = request.app.state.kube.reset_all()
    docker_results = request.app.state.docker.reset_all()
    ACTIVE.clear()
    active_scenarios_gauge.set(0)
    # Zero every per-scenario series so Grafana annotations close cleanly.
    for scenario in ALL_SCENARIOS:
        target = scenario.default_target_workload or scenario.target_service
        scenario_active_gauge.labels(scenario.name, scenario.category, target).set(0)
    if engine is not None:
        engine.record("info", f"reset — cleared {cleared} flag(s), reverted Docker and Kubernetes chaos")
    logger.info("chaos_reset", cleared_flags=cleared)
    return {
        "ok": True,
        "message": f"cleared {cleared} Redis chaos flag(s) and reverted Docker + Kubernetes chaos",
        "kubernetes": kube_results,
        "docker": docker_results,
    }


async def _read_json(request: Request) -> dict[str, Any]:
    try:
        body = await request.body()
        if not body:
            return {}
        import json

        data = json.loads(body)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}
