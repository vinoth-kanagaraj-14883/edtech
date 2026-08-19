import asyncio
import json
import logging
import os
import random
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Coroutine

import httpx
import redis.asyncio as aioredis
import structlog
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from opentelemetry import trace
from opentelemetry.baggage.propagation import W3CBaggagePropagator
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.composite import CompositePropagator
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import SpanKind, Status, StatusCode
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from chaos import ChaosPoller, apply_chaos
from database import check_database_health, create_tables, dispose_engine, get_engine, get_session
from models import Payment
from schemas import PaymentCreate, PaymentListResponse, PaymentResponse

DEFAULT_PAYMENT_AMOUNT = 49.99
MOCK_PSP_URL = 'https://mock-psp.internal/charge'
IDENTITY_HEADERS = ('X-User-Id', 'X-User-Role', 'X-User-Email')


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix='', extra='ignore', case_sensitive=False)

    service_name: str = 'payment-service'
    environment: str = 'production'
    database_url: str = 'postgresql://edtech:edtech_password@postgres:5432/paymentdb'
    user_service_url: str = 'http://user-service:8001'
    course_service_url: str = 'http://course-service:8002'
    notification_service_url: str = 'http://notification-service:8005'
    redis_addr: str = 'redis:6379'
    redis_password: str = ''
    cors_origins: list[str] = ['*']

    @field_validator('cors_origins', mode='before')
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(',') if item.strip()]
        return value

    @field_validator(
        'user_service_url', 'course_service_url', 'notification_service_url', mode='after'
    )
    @classmethod
    def strip_trailing_slash(cls, value: str) -> str:
        return value.rstrip('/')


def resolve_otlp_endpoint() -> str:
    # Prefer the standard OTel env var, fall back to the legacy OTLP_ENDPOINT
    # name some services in this stack use, then the compose default.
    for env_name in ('OTEL_EXPORTER_OTLP_ENDPOINT', 'OTLP_ENDPOINT'):
        value = os.getenv(env_name, '').strip()
        if value:
            return value
    return 'otel-collector:4317'


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
    'payment_service_http_requests_total',
    'Total HTTP requests handled by the payment service',
    ['method', 'path', 'status'],
)
request_latency = Histogram(
    'payment_service_http_request_duration_seconds',
    'HTTP request latency for the payment service',
    ['method', 'path'],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)
transactions_counter = Counter(
    'payment_transactions_total',
    'Total payment transactions by final status',
    ['status'],
)
fastapi_instrumentor = FastAPIInstrumentor()
sqlalchemy_instrumentor = SQLAlchemyInstrumentor()
httpx_instrumentor = HTTPXClientInstrumentor()

_background_tasks: set[asyncio.Task] = set()


class PSPError(Exception):
    """Raised when the (mock) payment service provider rejects a charge."""


def configure_telemetry(app: FastAPI) -> TracerProvider:
    resource = Resource.create(
        {
            'service.name': settings.service_name,
            'deployment.environment': settings.environment,
        }
    )
    tracer_provider = TracerProvider(resource=resource)
    span_processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=resolve_otlp_endpoint(), insecure=True))
    tracer_provider.add_span_processor(span_processor)
    trace.set_tracer_provider(tracer_provider)

    # Explicitly register the W3C trace-context + baggage propagator so the
    # incoming traceparent from the api-gateway is extracted and this service's
    # spans join the same distributed trace, and outbound httpx calls inject
    # the same headers toward user/course/notification services.
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
    await create_tables()
    app.state.http_client = httpx.AsyncClient(timeout=httpx.Timeout(5.0))
    app.state.redis = create_redis_client()
    app.state.chaos_poller = ChaosPoller(app.state.redis)
    await app.state.chaos_poller.start()
    logger.info('service_started', port=8007)
    try:
        yield
    finally:
        logger.info('service_shutting_down')
        await app.state.chaos_poller.stop()
        await app.state.http_client.aclose()
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


app = FastAPI(title='Payment Service', version='1.0.0', lifespan=lifespan)
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


def _forward_identity_headers(request: Request) -> dict[str, str]:
    headers: dict[str, str] = {}
    for name in IDENTITY_HEADERS:
        value = request.headers.get(name)
        if value:
            headers[name] = value
    return headers


def _fire_and_forget(coro: Coroutine[Any, Any, Any]) -> None:
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


def _extract_course_price(data: Any) -> float | None:
    if not isinstance(data, dict):
        return None
    course = data.get('course') if isinstance(data.get('course'), dict) else data
    price = course.get('price')
    if isinstance(price, bool):
        return None
    if isinstance(price, (int, float)) and price > 0:
        return float(price)
    if isinstance(price, str):
        try:
            parsed = float(price)
        except ValueError:
            return None
        return parsed if parsed > 0 else None
    return None


async def charge_mock_psp(amount: float, currency: str) -> str:
    """Charge the mock payment service provider.

    Wrapped in a MANUAL OTel CLIENT span so mock-psp shows up as an external
    dependency node in flow maps (there is no real HTTP call to instrument).
    """
    tracer = trace.get_tracer(settings.service_name)
    with tracer.start_as_current_span('POST mock-psp/charge', kind=SpanKind.CLIENT) as span:
        span.set_attribute('peer.service', 'mock-psp')
        span.set_attribute('http.request.method', 'POST')
        span.set_attribute('url.full', MOCK_PSP_URL)
        span.set_attribute('payment.amount', amount)
        span.set_attribute('payment.currency', currency)

        await asyncio.sleep(random.uniform(0.08, 0.25))

        poller: ChaosPoller | None = getattr(app.state, 'chaos_poller', None)
        if poller is not None and poller.state.payment_gateway_down:
            span.set_attribute('http.response.status_code', 503)
            span.set_status(Status(StatusCode.ERROR, 'payment gateway unavailable (chaos:payment-gateway:down)'))
            raise PSPError('payment provider unavailable')

        span.set_attribute('http.response.status_code', 200)
        span.set_status(Status(StatusCode.OK))
        return str(uuid.uuid4())


async def _send_notification(payload: dict[str, Any]) -> None:
    """Best-effort POST to notification-service; failures are logged, never raised."""
    try:
        client: httpx.AsyncClient = app.state.http_client
        response = await client.post(f'{settings.notification_service_url}/notifications', json=payload)
        if response.status_code >= 400:
            logger.warning(
                'notification_send_failed',
                status_code=response.status_code,
                notification_type=payload.get('type'),
            )
    except Exception as exc:
        logger.warning('notification_send_failed', error=str(exc), notification_type=payload.get('type'))


async def _publish_payment_completed(payment: Payment) -> None:
    event = {
        'userId': payment.user_id,
        'courseId': payment.course_id,
        'paymentId': str(payment.id),
        'amount': float(payment.amount),
    }
    try:
        await app.state.redis.publish('payment.completed', json.dumps(event))
    except Exception as exc:
        logger.warning('payment_event_publish_failed', error=str(exc), payment_id=str(payment.id))


@app.post('/payments', response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payload: PaymentCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    user_id = (request.headers.get('X-User-Id') or '').strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='X-User-Id header is required')

    client: httpx.AsyncClient = app.state.http_client
    identity_headers = _forward_identity_headers(request)

    # 1. Validate the paying user against user-service.
    try:
        user_response = await client.get(
            f'{settings.user_service_url}/users/{user_id}', headers=identity_headers
        )
    except httpx.HTTPError as exc:
        logger.warning('user_service_unreachable', error=str(exc), user_id=user_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail='user service unavailable') from exc
    if user_response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='user not found')
    if user_response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='user is not valid for payment')
    if user_response.status_code >= 400:
        logger.warning('user_validation_failed', status_code=user_response.status_code, user_id=user_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail='user service unavailable')

    # 2. Resolve the amount: explicit body amount > course price > default.
    amount = payload.amount
    try:
        course_response = await client.get(
            f'{settings.course_service_url}/courses/{payload.course_id}', headers=identity_headers
        )
        if course_response.status_code == status.HTTP_200_OK:
            price = _extract_course_price(course_response.json())
            if amount is None and price is not None:
                amount = price
        else:
            logger.warning(
                'course_lookup_failed',
                status_code=course_response.status_code,
                course_id=payload.course_id,
            )
    except httpx.HTTPError as exc:
        logger.warning('course_service_unreachable', error=str(exc), course_id=payload.course_id)
    if amount is None:
        amount = DEFAULT_PAYMENT_AMOUNT
    amount = round(float(amount), 2)

    payment = Payment(
        user_id=user_id,
        course_id=payload.course_id,
        amount=Decimal(str(amount)),
        currency='USD',
        status='pending',
        provider='mock-psp',
    )

    # 3. Charge the mock PSP.
    try:
        provider_ref = await charge_mock_psp(amount, payment.currency)
    except PSPError:
        payment.status = 'failed'
        session.add(payment)
        await session.commit()
        await session.refresh(payment)
        transactions_counter.labels('failed').inc()
        logger.warning(
            'payment_failed',
            payment_id=str(payment.id),
            user_id=user_id,
            course_id=payload.course_id,
            amount=amount,
            reason='psp_unavailable',
        )
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={'error': 'payment provider unavailable'},
        )

    # 4. Persist the completed payment.
    payment.status = 'completed'
    payment.provider_ref = provider_ref
    session.add(payment)
    await session.commit()
    await session.refresh(payment)
    transactions_counter.labels('completed').inc()
    logger.info(
        'payment_completed',
        payment_id=str(payment.id),
        user_id=user_id,
        course_id=payload.course_id,
        amount=amount,
        provider_ref=provider_ref,
    )

    # 5. Enroll the user into the course (best-effort; 409 = already enrolled).
    try:
        enroll_response = await client.post(
            f'{settings.course_service_url}/courses/{payload.course_id}/enroll',
            headers=identity_headers,
            json={'user_id': user_id, 'userId': user_id},
        )
        if enroll_response.status_code == status.HTTP_409_CONFLICT:
            logger.info('enrollment_already_exists', user_id=user_id, course_id=payload.course_id)
        elif enroll_response.status_code >= 400:
            logger.warning(
                'enrollment_failed',
                status_code=enroll_response.status_code,
                user_id=user_id,
                course_id=payload.course_id,
            )
    except httpx.HTTPError as exc:
        logger.warning('enrollment_failed', error=str(exc), user_id=user_id, course_id=payload.course_id)

    # 6. Fire-and-forget notification to notification-service.
    _fire_and_forget(
        _send_notification(
            {
                'type': 'payment',
                'user_id': user_id,
                'userId': user_id,
                'course_id': payload.course_id,
                'courseId': payload.course_id,
                'payment_id': str(payment.id),
                'amount': float(payment.amount),
                'currency': payment.currency,
                'title': 'Payment successful',
                'message': (
                    f'Your payment of {float(payment.amount):.2f} {payment.currency} '
                    f'for course {payload.course_id} was successful.'
                ),
            }
        )
    )

    # 7. Publish the payment.completed event for other consumers.
    await _publish_payment_completed(payment)

    return PaymentResponse.model_validate(payment)


@app.get('/payments', response_model=PaymentListResponse)
async def list_payments(
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> PaymentListResponse:
    result = await session.scalars(select(Payment).order_by(Payment.created_at.desc()).limit(limit))
    return PaymentListResponse(payments=[PaymentResponse.model_validate(item) for item in result.all()])


@app.get('/payments/{payment_id}', response_model=PaymentResponse)
async def get_payment(payment_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> PaymentResponse:
    payment = await session.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Payment not found')
    return PaymentResponse.model_validate(payment)


@app.get('/users/{user_id}/payments', response_model=PaymentListResponse)
async def list_user_payments(
    user_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> PaymentListResponse:
    result = await session.scalars(
        select(Payment).where(Payment.user_id == user_id).order_by(Payment.created_at.desc()).limit(limit)
    )
    return PaymentListResponse(payments=[PaymentResponse.model_validate(item) for item in result.all()])


@app.post('/payments/{payment_id}/refund', response_model=PaymentResponse)
async def refund_payment(payment_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> PaymentResponse:
    payment = await session.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Payment not found')
    if payment.status != 'completed':
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'Only completed payments can be refunded (current status: {payment.status})',
        )

    payment.status = 'refunded'
    payment.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(payment)
    transactions_counter.labels('refunded').inc()
    logger.info(
        'payment_refunded',
        payment_id=str(payment.id),
        user_id=payment.user_id,
        course_id=payment.course_id,
        amount=float(payment.amount),
    )

    _fire_and_forget(
        _send_notification(
            {
                'type': 'payment',
                'user_id': payment.user_id,
                'userId': payment.user_id,
                'course_id': payment.course_id,
                'courseId': payment.course_id,
                'payment_id': str(payment.id),
                'amount': float(payment.amount),
                'currency': payment.currency,
                'title': 'Payment refunded',
                'message': (
                    f'Your payment of {float(payment.amount):.2f} {payment.currency} '
                    f'for course {payment.course_id} has been refunded.'
                ),
            }
        )
    )

    return PaymentResponse.model_validate(payment)


@app.get('/health')
async def health() -> dict[str, str]:
    return {'status': 'ok', 'service': settings.service_name}


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
