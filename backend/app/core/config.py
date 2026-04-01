from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Etut API"
    debug: bool = False

    # Database
    database_url: str = (
        "postgresql+asyncpg://etut:etut_dev_password@localhost:5432/etut"
    )

    # GCP / Gemini AI
    google_application_credentials: str = "./gcp.json"
    gcp_project_id: str = ""
    gcp_location: str = "global"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    model_config = {"env_file": ".env"}


settings = Settings()
