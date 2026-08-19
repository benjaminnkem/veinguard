import os

os.environ.setdefault("SERVICE_TOKEN", "test-simulation-token")
os.environ.setdefault("VEINGUARD_SIM_IN_PROCESS", "1")

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from veinguard_sim.main import app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-simulation-token"}
