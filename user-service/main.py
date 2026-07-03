import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from passlib.context import CryptContext
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import check_database_health, dispose_engine, get_engine, get_session
from models import User
from schemas import LoginRequest, TokenResponse, UserCreate, UserResponse, UserUpdate


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix='', extra='ignore', case_sensitive=False)

    service_name: str = 'user-service'
    environment: str = 'production'
    database_url: str = 'postgresql://user_service@localhost:5432/user_service'
    jwt_secret_key: str = 'change-me-in-production'
    jwt_algorithm: str = 'HS256'
    jwt_expiration_hours: int = 24
    cors_origins: list[str] = ['*']
    otlp_endpoint: str = 'otel-collector:4317'

    @field_validator('cors_origins', mode='before')
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(',') if item.strip()]
        return value


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
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
auth_scheme = HTTPBearer(auto_error=False)
request_counter = Counter(
    'user_service_http_requests_total',
    'Total HTTP requests handled by the user service',
    ['method', 'path', 'status_code'],
)
request_latency = Histogram(
    'user_service_http_request_duration_seconds',
    'HTTP request latency for the user service',
    ['method', 'path'],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)
fastapi_instrumentor = FastAPIInstrumentor()
sqlalchemy_instrumentor = SQLAlchemyInstrumentor()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user: User) -> TokenResponse:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=settings.jwt_expiration_hours)
    payload = {
        'sub': str(user.id),
        'email': user.email,
        'role': user.role,
        'iat': int(now.timestamp()),
        'exp': expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return TokenResponse(
        access_token=token,
        expires_in=int(timedelta(hours=settings.jwt_expiration_hours).total_seconds()),
    )


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired token') from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Authentication required')

    payload = decode_access_token(credentials.credentials)
    try:
        user_id = uuid.UUID(payload['sub'])
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token subject') from exc

    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User is inactive or missing')

    return user


def ensure_user_access(target_user_id: uuid.UUID, current_user: User) -> None:
    if current_user.role != 'admin' and current_user.id != target_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient permissions')


def configure_telemetry(app: FastAPI) -> TracerProvider:
    resource = Resource.create(
        {
            'service.name': settings.service_name,
            'deployment.environment': settings.environment,
        }
    )
    tracer_provider = TracerProvider(resource=resource)
    span_processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otlp_endpoint, insecure=True))
    tracer_provider.add_span_processor(span_processor)
    trace.set_tracer_provider(tracer_provider)

    fastapi_instrumentor.instrument_app(app, tracer_provider=tracer_provider, excluded_urls='/health,/ready,/metrics')
    sqlalchemy_instrumentor.instrument(engine=get_engine().sync_engine, tracer_provider=tracer_provider)
    return tracer_provider


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info('service_starting')
    tracer_provider = configure_telemetry(app)
    app.state.tracer_provider = tracer_provider
    logger.info('service_started')
    try:
        yield
    finally:
        logger.info('service_shutting_down')
        fastapi_instrumentor.uninstrument_app(app)
        sqlalchemy_instrumentor.uninstrument()
        await dispose_engine()
        tracer_provider.shutdown()
        logger.info('service_stopped')


app = FastAPI(title='User Service', version='1.0.0', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


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


@app.post('/auth/register', response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(payload: UserCreate, session: AsyncSession = Depends(get_session)) -> UserResponse:
    existing_user = await session.scalar(select(User).where(User.email == payload.email))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Email already registered')

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=True,
        profile_picture_url=payload.profile_picture_url,
        bio=payload.bio,
    )
    session.add(user)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Unable to create user') from exc

    await session.refresh(user)
    logger.info('user_registered', user_id=str(user.id), email=user.email, role=user.role)
    return UserResponse.model_validate(user)


@app.post('/auth/login', response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    user = await session.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid email or password')
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='User account is inactive')

    logger.info('user_logged_in', user_id=str(user.id), email=user.email)
    return create_access_token(user)


@app.get('/users/{id}', response_model=UserResponse)
async def get_user(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    ensure_user_access(id, current_user)
    user = await session.get(User, id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')
    return UserResponse.model_validate(user)


@app.put('/users/{id}', response_model=UserResponse)
async def update_user(
    id: uuid.UUID,
    payload: UserUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    ensure_user_access(id, current_user)
    user = await session.get(User, id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')

    updates = payload.model_dump(exclude_unset=True)
    if current_user.role != 'admin' and {'role', 'is_active'} & updates.keys():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Only admins can change role or activation status')

    if 'email' in updates and updates['email'] != user.email:
        existing_user = await session.scalar(select(User).where(User.email == updates['email']))
        if existing_user is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Email already registered')

    for field_name, value in updates.items():
        setattr(user, field_name, value)

    user.updated_at = datetime.now(timezone.utc)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Unable to update user') from exc

    await session.refresh(user)
    logger.info('user_updated', user_id=str(user.id), updated_fields=sorted(updates.keys()))
    return UserResponse.model_validate(user)


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
