"""
app/utils/logger.py

Centralised logging configuration for Straw Ledger backend.
Call setup_logging() once at application startup.
"""
import logging
import sys
from app.config.settings import get_settings


def setup_logging() -> None:
    """Configure the root logger based on LOG_LEVEL from settings."""
    settings = get_settings()
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stdout,
    )

    # Quiet noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    logging.getLogger(__name__).info(
        "Logging configured at level: %s", settings.log_level.upper()
    )


def get_logger(name: str) -> logging.Logger:
    """Return a named logger for use in modules."""
    return logging.getLogger(name)