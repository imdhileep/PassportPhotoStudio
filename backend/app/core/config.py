from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "postgresql+psycopg://homesnapshare:homesnapshare@db:5432/homesnapshare"
    redis_url: str = "redis://redis:6379/0"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 1440

    media_root: str = "/data/media"
    thumb_root: str = "/data/thumbs"
    import_root: str = "/data/import"
    importer_enabled: bool = True
    import_interval_seconds: int = 10

    ai_enabled: bool = True
    face_match_threshold: float = 0.6

    admin_email: str = "admin@example.com"
    admin_password: str = "admin123"
    reverse_geocode_enabled: bool = False
    location_label_style: str = "decimal"


settings = Settings()
