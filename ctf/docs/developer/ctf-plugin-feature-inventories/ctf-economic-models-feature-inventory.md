# CTF Economic Models Feature Inventory

> **Note:** Economic Models is a shared library/service package (`@ctf/economic-models` under `ctf/packages/economic-models`) consumed by transparency/admin surfaces. It is not a registered plugin (no `/api/economic-models/*` routes shipped under the Next.js app, no entry in `lib/plugins/repository.ts`). This file is retained as a non-plugin module inventory; Rule 120 plugin-required sections do not apply.

**Plugin Slug:** economic-models
**Location:** ctf/packages/economic-models
**Inventory Type:** Module / shared library

---

## Scope and Module Boundary

- Provides three economic interdependence measurement modules (Hierarchical Network, Geopolitical, Input-Output/Trade Linkage).
- Consumes anonymized, aggregated event data from DB/plugins.
- Exposes a library API (`api.ts`) and ETL pipeline (`etl.ts`) for in-process use by hosting surfaces.
- Strictly privacy-preserving; no PII processed.

## Implemented User Features

- Library functions for retrieving per-user, per-community, and global interdependence scores.
- Human-readable explanations and uncertainty/confidence metrics for each score.
- Dashboard-ready data shapes for time-series, heatmaps, and network graphs.

## Implemented Admin Features

- Statistical drift detection and validation outputs.
- ETL pipeline for data extraction, transformation, and anonymization (`etl.ts`).

## Library API Surface

- `module-network.ts` — Hierarchical Network module analysis.
- `module-geopolitical.ts` — Geopolitical module analysis.
- `module-inputoutput.ts` — Input-Output module analysis.
- `server.ts` — Server-side composition entry point.

## Data Model and Storage Contracts

- See `schemas.ts` for anonymized record formats:
  - `TransactionRecord`
  - `RegionalFlowRecord`
  - `InputOutputRecord`
- All data is anonymized and aggregated before analysis.
- No raw PII is stored or processed by this module.

## Changelog

- 2026-05-18: Reframed as a shared module/library (not a plugin). Removed "planned" annotations on admin features. Renamed "API Surface and Route Map" to "Library API Surface" (no HTTP routes are owned).
- 2026-03-31: Initial inventory created.
