# Scripts Directory

## Purpose
Monorepo scripts for build, migration, seeding, and CI gates.

## Script Categories

| Category         | Scripts (examples)                | Description                                  |
|------------------|-----------------------------------|----------------------------------------------|
| Build/Lint/CI    | `build-all.sh`, `lint-all.sh`     | Build and lint all packages                  |
| Schema/Migration | `runAllMigrations.mjs`, `runMigrationFile.mjs`, `audit_schema_drift.sh` | DB migrations and drift checks               |
| Seeding          | `seedChymePhase0.mjs`, `seedClicklogPhase0.mjs`, ... | Seed data by phase                           |
| Skills Taxonomy (Data)  | `skills-lock.json`                | Skills system lockfile                       |
| Formance/Ledger  | `formance-backup.sh`, `formanceRailwayBootstrap.sh` | Formance ledger management                   |
| Performance/Budget| `performanceBudgetAudit.mjs`, `githubActionsBudgetMonitor.mjs` | Performance and budget audits                |

## Environment Variables
- `DATABASE_URL` — required for DB scripts
- `FORMANCE_*` — required for Formance scripts

## CI vs Developer Scripts
- Some scripts are CI-only (e.g., audit, budget monitor)
- Others are for local development (e.g., seeding, migrations)

## Fresh Environment Setup
Recommended run order:
1. `runAllMigrations.mjs`
2. Seed scripts (by phase)
3. `build-all.sh`
4. `lint-all.sh`
