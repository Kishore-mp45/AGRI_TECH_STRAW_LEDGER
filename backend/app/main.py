"""
app/main.py

Straw Ledger FastAPI application entry point.

Responsibilities:
  - Application factory and lifespan management
  - CORS middleware configuration
  - Global exception handlers
  - Health and DB connectivity endpoints
  - Module router registration under /api/v1
"""
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.config.settings import get_settings
from app.database.connection import check_db_connection
from app.utils.logger import setup_logging
from app.utils.response import error_response, success_response

# ---------------------------------------------------------------------------
# Logging — set up before anything else
# ---------------------------------------------------------------------------
setup_logging()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — startup and shutdown events
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and graceful shutdown."""
    settings = get_settings()
    logger.info("Starting Straw Ledger API [env=%s]", settings.app_env)

    # Verify DB connection on startup
    db_status = check_db_connection()
    if db_status["status"] == "connected":
        logger.info("Database connection verified.")
    else:
        logger.warning("Database connection check failed: %s", db_status["message"])

    yield  # Application runs here

    logger.info("Straw Ledger API shutting down.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(
        title=settings.app_title,
        version=settings.app_version,
        description=(
            "Straw Ledger — Agri-Tech platform for managing rice straw collection, "
            "pyrolysis processing, carbon calculation, and farmer payouts."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # -----------------------------------------------------------------------
    # CORS Middleware
    # In development: allow all origins (including file://)
    # In production: restrict to configured origins only
    # -----------------------------------------------------------------------
    if settings.is_development:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,   # cannot combine credentials with wildcard origin
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins_list,
            allow_origin_regex=r"https://[a-z0-9-]+\.vercel\.app",
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # -----------------------------------------------------------------------
    # Global Exception Handlers
    # -----------------------------------------------------------------------

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Handle Pydantic request validation failures with structured errors."""
        errors = []
        for err in exc.errors():
            errors.append({
                "field": " -> ".join(str(loc) for loc in err.get("loc", [])),
                "message": err.get("msg", "Validation error"),
                "type": err.get("type", ""),
            })
        logger.warning("Validation error on %s %s: %s", request.method, request.url, errors)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_response(
                message="Request validation failed. Please check your input.",
                errors=errors,
            ),
        )

    @application.exception_handler(HTTPException)
    async def http_exception_handler(
        request: Request, exc: HTTPException
    ) -> JSONResponse:
        """Handle HTTPExceptions with the standard response envelope."""
        logger.warning(
            "HTTP %d on %s %s: %s",
            exc.status_code, request.method, request.url, exc.detail,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(message=str(exc.detail)),
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Catch-all handler for unexpected server errors."""
        logger.exception(
            "Unhandled exception on %s %s", request.method, request.url
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_response(
                message="An unexpected internal server error occurred. Please try again later."
            ),
        )

    # -----------------------------------------------------------------------
    # Health Endpoints  (outside /api/v1 — no auth required)
    # -----------------------------------------------------------------------

    @application.get(
        "/health",
        tags=["Health"],
        summary="Application health check",
        description="Returns the running status of the API server.",
    )
    def health_check() -> Any:
        settings = get_settings()
        return success_response(
            data={
                "env": settings.app_env,
                "version": settings.app_version,
            },
            message="Straw Ledger API is running.",
        )

    @application.get(
        "/health/db",
        tags=["Health"],
        summary="Database connectivity check",
        description="Pings the Supabase PostgreSQL database and returns its connectivity status.",
    )
    def health_db() -> Any:
        db_status = check_db_connection()
        if db_status["status"] != "connected":
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content=error_response(
                    message="Database connectivity check failed.",
                    errors=[{"detail": db_status["message"]}],
                ),
            )
        return success_response(
            data=db_status,
            message="Database connection is healthy.",
        )

    # -----------------------------------------------------------------------
    # Module Routers
    # -----------------------------------------------------------------------
    application.include_router(api_router)

    return application


# ---------------------------------------------------------------------------
# Application instance (imported by Uvicorn)
# ---------------------------------------------------------------------------
app = create_app()