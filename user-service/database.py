import os
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DEFAULT_DATABASE_URL = 'postgresql://user_service@localhost:5432/user_service'


class Base(DeclarativeBase):
    pass


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_database_url() -> str:
    return os.getenv('DATABASE_URL', DEFAULT_DATABASE_URL)


def _normalize_async_database_url(database_url: str) -> str:
    if database_url.startswith('postgresql+asyncpg://'):
        return database_url
    if database_url.startswith('postgresql://'):
        return database_url.replace('postgresql://', 'postgresql+asyncpg://', 1)
    if database_url.startswith('postgres://'):
        return database_url.replace('postgres://', 'postgresql+asyncpg://', 1)
    return database_url


def get_engine() -> AsyncEngine:
    global _engine, _session_factory

    if _engine is None:
        _engine = create_async_engine(
            _normalize_async_database_url(get_database_url()),
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            pool_recycle=1800,
            future=True,
        )
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False, autoflush=False)

    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    if _session_factory is None:
        get_engine()
    assert _session_factory is not None
    return _session_factory


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        yield session


async def check_database_health() -> bool:
    try:
        async with get_session_factory()() as session:
            await session.execute(text('SELECT 1'))
        return True
    except Exception:
        return False


async def dispose_engine() -> None:
    global _engine, _session_factory

    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
