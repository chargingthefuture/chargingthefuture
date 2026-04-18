# Ops Directory

## Purpose
Local development infrastructure, currently focused on the Formance ledger stack.

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
