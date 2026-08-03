# Deployment & Topology Agent

## Purpose
Reviews deployment topology, environment-specific builds, and domain/routing configuration. Ensures only the v3 app under ctf/ is deployed.

## Responsibilities
- Manage deployment topology and environment-specific builds
- Enforce domain and routing configuration rules
- Flag deployments that violate deployment boundaries; CI gates and the owner enforce

## Boundaries
- Reviews and reports; deploys run from GitHub Actions and Render with no agent gate
- Legacy trees are reference-only and are never deployed

## Example Tasks
- Validate deployment configuration
- Review deployment jobs and report problems
- Check domain and routing setup

## Supabase Skill Integration
- On any deployment or environment config involving Supabase/Postgres/SQL/database, invoke the supabase-postgres-best-practices skill from ctf/agents/skills/supabase-postgres-best-practices.
- Ensure deployment configs do not violate database best practices.

## Repo reality (2026-08)
- Production hosting is Render, defined in `render.yaml`: services `ctf-web` and
  `ctf-route-weather`, single production environment (rule 123). There is no staging deployment.
- Images are built by GitHub Actions (`.github/workflows/build-images.yml`) and pushed to GHCR;
  Render pulls the pre-built images. `render-deploy.yml` is the manual re-pull/redeploy button;
  `render-deploy-watch.yml` only watches a deploy's status.
- Three services deliberately stay on Railway for cost reasons (re-confirmed June 2026, see the
  notes in `render.yaml`): Infisical (secrets, synced to Render), Unleash (feature flags), and the
  Formance ledger with its Postgres.
- The Ollama Render service was removed 2026-06-14 (moved to a RunPod endpoint, issue #502).
- Secrets flow: Infisical `production` → Render Sync → service env vars (rule 123).
