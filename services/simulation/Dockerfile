FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    NETWORK_DATA_DIR=/app/data/networks

COPY services/simulation/pyproject.toml ./
COPY services/simulation/veinguard_sim ./veinguard_sim
COPY data/networks ./data/networks

RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir .

EXPOSE 8000

CMD ["uvicorn", "veinguard_sim.main:app", "--host", "0.0.0.0", "--port", "8000"]
