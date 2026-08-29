"""
app/config/settings.py

Central configuration module using Pydantic BaseSettings.
All values are loaded from environment variables or .env files.
No secrets are ever hardcoded here.
"""
import os
from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Looks for a .env file in the backend/ directory first,
    then falls back to the project root .env.
    """

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_title: str = "Straw Ledger API"
    app_version: str = "1.0.0"
    app_env: str = "development"
    app_debug: bool = True

    # Database
    database_url: str

    # Supabase
    supabase_url: str = ""
    supabase_api_key: str = ""

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:5500"

    # Logging
    log_level: str = "INFO"

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v:
            raise ValueError("DATABASE_URL must be set in environment variables.")
        # SQLAlchemy requires postgresql+psycopg2:// dialect prefix
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse the comma-separated CORS origins string into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() == "development"


@lru_cache()
def get_settings() -> Settings:
    """
    Returns a cached instance of the Settings object.
    Using lru_cache ensures settings are only loaded once per process.
    """
    return Settings()