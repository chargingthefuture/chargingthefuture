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

## Rasa (AI Assistant NLU)

`rasa/` — Rasa 3.x **NLU-only** project + `Dockerfile` for the `ctf-rasa` Render service. The NLU model is **trained at build time** (`rasa train nlu`) and baked into the image, so the container serves the stateless `POST /model/parse` endpoint with no runtime training. The comic backend (`lib/comic/rasa.ts`) calls it server-side at `http://ctf-rasa:5005` to attach a real intent + confidence to each `@comic` turn. Image rebuilds only when `ctf/ops/rasa/**` changes (path-filtered in `build-images.yml`). The action server and SQL tracker store are deferred. See `docs/developer/RASA.md` for the deploy runbook.
