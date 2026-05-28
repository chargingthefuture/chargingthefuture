# Spec: Infisical as Single Source of Truth for Secrets (Historical)

> **Status:** ARCHIVED — This is a historical planning document from the Railway era.
> See `AGENTS.md` for current secret management architecture using Infisical + Render.

---

## Current Architecture (as of May 2026)

**Infisical is the single source of truth.** Render infrastructure migrated from Railway.

```
Infisical (self-hosted on Railway)
    ├── Project: chargingthefuture
    │   ├── Environment: staging (72 secrets)
    │   └── Environment: production
    │
    ├── GitHub Actions  → infisical/secrets-action injects secrets at job start
    ├── Render services → Infisical Render Sync integration pushes secrets to services
    └── Previews        → ctf-preview-secrets env group (inherited by PR previews)
```

**Bootstrap secrets:**
- GitHub Actions: `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, `INFISICAL_PROJECT_SLUG`, `INFISICAL_URL`
- Ona project: `INFISICAL_TOKEN`, `INFISICAL_PROJECT_ID`, `GITHUB_TOKEN`

See `AGENTS.md` § "Secrets — Infisical is the single source of truth" for details.

---

## Legacy Content

The original Railway-era migration spec is preserved below for reference only.

---

## Constraints

- `INFISICAL_TOKEN` and `INFISICAL_PROJECT_ID` are the only secrets that remain outside Infisical. They are the bootstrap credentials needed to reach Infisical.
- Secret values must never be committed to the repository.
- Secret names in Infisical are the canonical contract — no renaming without explicit user approval.
- The Infisical service on Railway cannot self-reference for its own secrets — it must be bootstrapped manually.
- The Railway Postgres service is managed by Railway and does not need Infisical integration.
