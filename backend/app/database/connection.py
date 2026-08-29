"""
app/database/connection.py

SQLAlchemy engine and session factory connected to Supabase PostgreSQL.
Uses connection pooling. Never import credentials directly — always via settings.
"""
import logging
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


def _build_engine():
    """Create the SQLAlchemy engine using the DATABASE_URL from settings."""
    settings = get_settings()
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,      # Verify connections before use
        pool_size=5,             # Keep 5 connections open in pool
        max_overflow=10,         # Allow up to 10 extra connections under load
        pool_recycle=1800,       # Recycle connections every 30 minutes
        echo=False,  # SQL logging handled via sqlalchemy.engine logger level
    )
    return engine


# Module-level engine and session factory (created once on import)
engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a database session.
    Automatically commits on success and rolls back on error.

    Usage:
        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """Context manager version of get_db for use outside FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_db_connection() -> dict:
    """
    Ping the database and return connection status.
    Used by the /health/db endpoint.
    """
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 AS ping"))
            row = result.fetchone()
            if row and row[0] == 1:
                return {"status": "connected", "message": "Database connection is healthy."}
    except Exception as exc:
        logger.error("Database connectivity check failed: %s", exc)
        return {"status": "error", "message": str(exc)}
    return {"status": "unknown", "message": "Unexpected result from ping query."}