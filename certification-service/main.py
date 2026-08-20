import logging
import os
import secrets
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import httpx
import redis.asyncio as aioredis
import structlog
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.composite import CompositePropagator
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from opentelemetry.baggage.propagation import W3CBaggagePropagator
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from chaos import ChaosPoller, apply_chaos
from database import Base, check_database_health, dispose_engine, get_engine, get_session
from models import Certificate
from schemas import CertificateCreate, CertificateResponse, CertificateVerification


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix='', extra='ignore', case_sensitive=False)

    service_name: str = 'certification-service'
    environment: str = 'production'
    database_url: str = 'postgresql://edtech:edtech_password@postgres:5432/certificationdb'
    cors_origins: list[str] = ['*']
    # This service reads the standard OTEL_EXPORTER_OTLP_ENDPOINT, falling back to
    # OTLP_ENDPOINT for consistency with the other EduForge services.
    otel_exporter_otlp_endpoint: str = 'otel-collector:4317'
    otlp_endpoint: str | None = None
    user_service_url: str = 'http://user-service:8001'
    course_service_url: str = 'http://course-service:8002'
    notification_service_url: str = 'http://notification-service:8005'
    redis_addr: str = 'redis:6379'
    redis_password: str = ''
    http_client_timeout: float = 5.0

    @field_validator('cors_origins', mode='before')
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(',') if item.strip()]
        return value

    @property
    def otlp_collector_endpoint(self) -> str:
        return self.otlp_endpoint or self.otel_exporter_otlp_endpoint


settings = Settings()
os.environ.setdefault('DATABASE_URL', settings.database_url)


def add_trace_context(_: Any, __: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    span = trace.get_current_span()
    span_context = span.get_span_context() if span else None
    event_dict['service'] = settings.service_name
    if span_context and span_context.is_valid:
        event_dict['trace_id'] = format(span_context.trace_id, '032x')
        event_dict['span_id'] = format(span_context.span_id, '016x')
    else:
        event_dict['trace_id'] = None
        event_dict['span_id'] = None
    return event_dict


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt='iso', utc=True, key='timestamp'),
            structlog.stdlib.add_log_level,
            add_trace_context,
            structlog.processors.EventRenamer('message'),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


configure_logging()
logger = structlog.get_logger(settings.service_name)
request_counter = Counter(
    'certification_service_http_requests_total',
    'Total HTTP requests handled by the certification service',
    ['method', 'route', 'status'],
)
request_latency = Histogram(
    'certification_service_http_request_duration_seconds',
    'HTTP request latency for the certification service',
    ['method', 'route'],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)
certificates_issued_counter = Counter(
    'certification_service_certificates_issued_total',
    'Total course-completion certificates issued by the certification service',
)
fastapi_instrumentor = FastAPIInstrumentor()
sqlalchemy_instrumentor = SQLAlchemyInstrumentor()
httpx_instrumentor = HTTPXClientInstrumentor()


def generate_certificate_number() -> str:
    return f'EDU-CERT-{secrets.token_hex(4).upper()}'


def resolve_user_id(request: Request, payload_user_id: str | None) -> str:
    # Trust the identity injected by the API gateway. The request body wins when
    # provided; otherwise fall back to the gateway-supplied X-User-Id header.
    if payload_user_id:
        return payload_user_id
    header_user_id = request.headers.get('X-User-Id')
    if header_user_id:
        return header_user_id
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='userId is required')


async def fetch_user_name(user_id: str) -> str | None:
    url = f'{settings.user_service_url}/users/{user_id}'
    try:
        async with httpx.AsyncClient(timeout=settings.http_client_timeout) as client:
            response = await client.get(url)
        if response.status_code != 200:
            return None
        data = response.json()
        return data.get('fullName') or data.get('full_name') or data.get('name')
    except Exception:
        logger.warning('user_lookup_failed', user_id=user_id)
        return None


async def fetch_course_title(course_id: str) -> str | None:
    url = f'{settings.course_service_url}/courses/{course_id}'
    try:
        async with httpx.AsyncClient(timeout=settings.http_client_timeout) as client:
            response = await client.get(url)
        if response.status_code != 200:
            return None
        data = response.json()
        return data.get('title') or data.get('courseTitle') or data.get('course_title')
    except Exception:
        logger.warning('course_lookup_failed', course_id=course_id)
        return None


async def send_certificate_notification(certificate: Certificate) -> None:
    url = f'{settings.notification_service_url}/notifications'
    course_label = certificate.course_title or certificate.course_id
    body = {
        'userId': certificate.user_id,
        'type': 'certificate.issued',
        'title': 'Certificate issued',
        'message': f'Your certificate for {course_label} has been issued.',
        'metadata': {'certificateNumber': certificate.certificate_number},
    }
    try:
        async with httpx.AsyncClient(timeout=settings.http_client_timeout) as client:
            await client.post(url, json=body)
    except Exception:
        logger.warning('notification_dispatch_failed', certificate_number=certificate.certificate_number)


def configure_telemetry(app: FastAPI) -> TracerProvider:
    resource = Resource.create(
        {
            'service.name': settings.service_name,
            'deployment.environment': settings.environment,
        }
    )
    tracer_provider = TracerProvider(resource=resource)
    span_processor = BatchSpanProcessor(
        OTLPSpanExporter(endpoint=settings.otlp_collector_endpoint, insecure=True)
    )
    tracer_provider.add_span_processor(span_processor)
    trace.set_tracer_provider(tracer_provider)

    # Explicitly register the W3C trace-context + baggage propagator so the
    # incoming traceparent from the api-gateway is extracted and this service's
    # spans join the same distributed trace (rather than starting a new root).
    # This also ensures outbound calls inject the same headers so the service-map
    # edges to user-service, course-service and notification-service appear.
    set_global_textmap(
        CompositePropagator([TraceContextTextMapPropagator(), W3CBaggagePropagator()])
    )

    fastapi_instrumentor.instrument_app(app, tracer_provider=tracer_provider, excluded_urls='/health,/ready,/metrics')
    sqlalchemy_instrumentor.instrument(engine=get_engine().sync_engine, tracer_provider=tracer_provider)
    httpx_instrumentor.instrument(tracer_provider=tracer_provider)
    app.state.tracer_provider = tracer_provider
    return tracer_provider


def create_redis_client() -> aioredis.Redis:
    host, _, port = settings.redis_addr.partition(':')
    return aioredis.Redis(
        host=host or 'redis',
        port=int(port) if port else 6379,
        password=settings.redis_password or None,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info('service_starting')
    engine = get_engine()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    app.state.redis = create_redis_client()
    app.state.chaos_poller = ChaosPoller(app.state.redis)
    await app.state.chaos_poller.start()
    logger.info('service_started')
    try:
        yield
    finally:
        logger.info('service_shutting_down')
        await app.state.chaos_poller.stop()
        try:
            await app.state.redis.aclose()
        except Exception:
            pass
        fastapi_instrumentor.uninstrument_app(app)
        sqlalchemy_instrumentor.uninstrument()
        httpx_instrumentor.uninstrument()
        await dispose_engine()
        tracer_provider = getattr(app.state, 'tracer_provider', None)
        if tracer_provider is not None:
            tracer_provider.shutdown()
        logger.info('service_stopped')


app = FastAPI(title='Certification Service', version='1.0.0', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.middleware('http')
async def chaos_middleware(request: Request, call_next):
    poller: ChaosPoller | None = getattr(app.state, 'chaos_poller', None)
    if poller is None:
        return await call_next(request)
    return await apply_chaos(poller, request, call_next)


@app.middleware('http')
async def metrics_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    except Exception:
        logger.exception('request_failed', method=request.method, path=request.url.path)
        raise
    finally:
        route = request.scope.get('route')
        path = getattr(route, 'path', request.url.path)
        request_counter.labels(request.method, path, str(status_code)).inc()
        request_latency.labels(request.method, path).observe(time.perf_counter() - start_time)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    logger.warning(
        'http_exception',
        method=request.method,
        path=request.url.path,
        status_code=exc.status_code,
        detail=exc.detail,
    )
    return JSONResponse(status_code=exc.status_code, content={'detail': exc.detail})


# Configure telemetry at import time (before the app starts serving). FastAPI /
# Starlette forbid adding middleware after startup, so instrumentation must run
# here rather than inside the lifespan handler.
configure_telemetry(app)


@app.post('/certificates', response_model=CertificateResponse, status_code=status.HTTP_201_CREATED)
async def issue_certificate(
    payload: CertificateCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> CertificateResponse:
    user_id = resolve_user_id(request, payload.user_id)
    course_id = payload.course_id

    # Idempotency: return the existing certificate for this (user, course) pair.
    existing = await session.scalar(
        select(Certificate).where(Certificate.user_id == user_id, Certificate.course_id == course_id)
    )
    if existing is not None:
        logger.info(
            'certificate_already_issued',
            certificate_number=existing.certificate_number,
            user_id=user_id,
            course_id=course_id,
        )
        return CertificateResponse.model_validate(existing)

    user_name = await fetch_user_name(user_id)
    course_title = await fetch_course_title(course_id)

    certificate = Certificate(
        id=str(uuid.uuid4()),
        certificate_number=generate_certificate_number(),
        user_id=user_id,
        user_name=user_name,
        course_id=course_id,
        course_title=course_title,
        status='issued',
    )
    session.add(certificate)

    try:
        await session.commit()
    except IntegrityError:
        # A concurrent request may have inserted the same (user, course) pair.
        await session.rollback()
        existing = await session.scalar(
            select(Certificate).where(Certificate.user_id == user_id, Certificate.course_id == course_id)
        )
        if existing is not None:
            return CertificateResponse.model_validate(existing)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Unable to issue certificate')

    await session.refresh(certificate)
    certificates_issued_counter.inc()
    logger.info(
        'certificate_issued',
        certificate_number=certificate.certificate_number,
        user_id=user_id,
        course_id=course_id,
    )

    await send_certificate_notification(certificate)

    return CertificateResponse.model_validate(certificate)


@app.get('/certificates', response_model=list[CertificateResponse])
async def list_my_certificates(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> list[CertificateResponse]:
    """The authenticated learner's certificates.

    `/users/{user_id}/certificates` exists but is unreachable through the API
    gateway: the gateway routes every `/api/users/*` prefix to user-service, so
    this service's own user-scoped path never receives the request. This endpoint
    resolves the learner from the gateway-injected identity instead, mirroring
    payment-service's `GET /payments`, so the frontend has a way to list them.
    """
    user_id = resolve_user_id(request, None)
    result = await session.scalars(
        select(Certificate).where(Certificate.user_id == user_id).order_by(Certificate.issued_at.desc())
    )
    return [CertificateResponse.model_validate(certificate) for certificate in result.all()]


@app.get('/certificates/{id}', response_model=CertificateResponse)
async def get_certificate(id: str, session: AsyncSession = Depends(get_session)) -> CertificateResponse:
    certificate = await session.get(Certificate, id)
    if certificate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Certificate not found')
    return CertificateResponse.model_validate(certificate)


@app.get('/certificates/{id}/verify', response_model=CertificateVerification)
async def verify_certificate(id: str, session: AsyncSession = Depends(get_session)) -> CertificateVerification:
    certificate = await session.get(Certificate, id)
    if certificate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Certificate not found')
    return CertificateVerification(
        valid=certificate.status == 'issued',
        certificate_number=certificate.certificate_number,
        user_name=certificate.user_name,
        course_title=certificate.course_title,
        issued_at=certificate.issued_at,
    )


@app.get('/users/{user_id}/certificates', response_model=list[CertificateResponse])
async def list_user_certificates(
    user_id: str,
    session: AsyncSession = Depends(get_session),
) -> list[CertificateResponse]:
    result = await session.scalars(
        select(Certificate).where(Certificate.user_id == user_id).order_by(Certificate.issued_at.desc())
    )
    return [CertificateResponse.model_validate(certificate) for certificate in result.all()]


@app.get('/health')
async def health() -> dict[str, str]:
    return {
        'status': 'ok',
        'service': settings.service_name,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }


@app.get('/ready')
async def ready() -> Response:
    if not await check_database_health():
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={'status': 'not_ready', 'service': settings.service_name},
        )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={'status': 'ready', 'service': settings.service_name},
    )


@app.get('/metrics')
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
