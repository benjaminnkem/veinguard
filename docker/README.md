# Docker

Local development currently runs **MongoDB** and **Redis** from the repository-root `docker-compose.yml`.

```bash
docker compose up -d --wait
```

Compose binds Mongo `27017` and Redis `6379`. If those ports are already taken by another local stack, either stop that stack or point `MONGODB_URI` / `REDIS_URL` at the existing instances.

The simulation service image lives at `services/simulation/Dockerfile`. It is a FastAPI-only image in Phase 01. EPANET/WNTR native dependencies are added in later phases.
