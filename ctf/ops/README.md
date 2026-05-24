# Ops Directory

## Purpose
Infrastructure configurations for Railway-deployed services and local development.

## Formance Stack
- 5-service Docker Compose:
  - postgres
  - ledger
  - worker
  - gateway
  - console
- Exposes required ports for local development.

## Starting the Stack
Run these commands from the project root (where `ops/docker-compose.yml` lives):
```sh
docker-compose -f ops/docker-compose.yml up -d
```
To stop:
```sh
docker-compose -f ops/docker-compose.yml down
```

## Production Differences
- Railway deployment uses managed services, not local Docker Compose.

## Known Gaps
- The `Caddyfile` referenced by the gateway is not present in the repo.

## Ollama

`ollama/Dockerfile` — custom image for the `ctf-ollama` Render service with the model baked in at build time. Render builds from this file; changing the model means updating the `ARG OLLAMA_MODEL` line and pushing. See `docs/developer/OLLAMA.md` for full instructions.
