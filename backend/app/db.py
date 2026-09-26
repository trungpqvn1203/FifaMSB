"""Async SQLAlchemy engine and session factory."""

from collections.abc import AsyncGenerator

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Stable constraint/index naming convention required so that
# IntegrityError handling can map constraint names to domain errors.
NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=NAMING_CONVENTION)

engine = create_async_engine(
    str(settings.database_url),
    echo=settings.environment == "development",
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionFactory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""

    metadata = metadata


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the active async_sessionmaker for creating sessions outside of request scope."""
    return AsyncSessionFactory


def set_session_factory(factory: async_sessionmaker[AsyncSession]) -> None:
    """Explicitly set the active async_sessionmaker (used by test fixtures)."""
    global AsyncSessionFactory
    AsyncSessionFactory = factory


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides an AsyncSession per request.

    The session is committed automatically; rollback occurs on exception.
    """
    async with AsyncSessionFactory() as session:
        yield session
