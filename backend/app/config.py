"""Application configuration using pydantic-settings."""

from pydantic import PostgresDsn, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All settings are loaded from environment variables or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    database_url: PostgresDsn = PostgresDsn(
        "postgresql+asyncpg://postgres:postgres@localhost:5432/webfifa"
    )

    # Security
    secret_key: str = "change-me-in-production"
    session_cookie_name: str = "session_token"
    session_expire_hours: int = 72

    # Server
    environment: str = "development"
    allowed_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Logging
    log_level: str = "INFO"

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        """Warn if secret_key is default in production."""
        if self.environment == "production" and self.secret_key == "change-me-in-production":
            raise ValueError("SECRET_KEY must be set in production environment")
        return self


# Single instance used across the application
settings = Settings()
