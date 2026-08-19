from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development", alias="APP_ENV")
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    service_token: str = Field(alias="SERVICE_TOKEN")
    network_data_dir: str = Field(default="../../data/networks", alias="NETWORK_DATA_DIR")
    calibration_data_dir: str = Field(
        default="../../data/calibration",
        alias="CALIBRATION_DATA_DIR",
    )
    georeference_data_dir: str = Field(
        default="../../data/georeference",
        alias="GEOREFERENCE_DATA_DIR",
    )
    fixture_data_dir: str = Field(
        default="../../data/fixtures",
        alias="FIXTURE_DATA_DIR",
    )
    constraints_data_dir: str = Field(
        default="../../data/constraints",
        alias="CONSTRAINTS_DATA_DIR",
    )
    objective_data_dir: str = Field(
        default="../../data/objective",
        alias="OBJECTIVE_DATA_DIR",
    )
    max_concurrent_simulations: int = Field(default=1, alias="MAX_CONCURRENT_SIMULATIONS")
    simulation_timeout_seconds: int = Field(default=120, alias="SIMULATION_TIMEOUT_SECONDS")
    thermal_model_version: str = Field(default="water-temp-v1", alias="THERMAL_MODEL_VERSION")
    free_chlorine_model_version: str = Field(
        default="free-chlorine-v1",
        alias="FREE_CHLORINE_MODEL_VERSION",
    )
    monochloramine_model_version: str = Field(
        default="monochloramine-v1",
        alias="MONOCHLORAMINE_MODEL_VERSION",
    )
    nitrification_risk_model_version: str = Field(
        default="nitrification-conditions-v1",
        alias="NITRIFICATION_RISK_MODEL_VERSION",
    )

    @field_validator("service_token")
    @classmethod
    def token_must_be_present(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 16:
            raise ValueError("SERVICE_TOKEN must be at least 16 characters")
        return cleaned


@lru_cache
def get_settings() -> Settings:
    return Settings()
