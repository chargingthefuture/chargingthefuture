# Mood Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Unified plugin scope slug: `mood`
- This document is the living snapshot of Mood per Rule 120.
- Plugin name to retain: `Mood`.

Scope decisions locked for this rewrite:

1. Mood is a standalone plugin and is not embedded in GentlePulse flows.
2. No severe-value safety trigger messaging is in Mood scope.
3. No Mood announcements UI/API scope is included.
4. No Mood in-app admin dashboard/UI scope is included.
5. Mood API posture is authenticated-user-only, with mood records persisted using anonymous `clientId`.

---

## 1) User Features

### 1.1 Mood Check Submission

1. Plugin route for mood check (`/apps/mood`).
2. Authenticated user can submit a mood check via `POST /api/mood/checks`.
3. Mood scale validation (`1..5`) is enforced.
4. Submission response does not include severe-value safety trigger fields.

### 1.2 Eligibility Window

1. Eligibility endpoint: `GET /api/mood/checks/eligible?clientId=...`.
2. Cooldown model: one check every 7 days.
3. If no prior record (or parse failure), client is treated as eligible.

## 2) Admin Features

### 2.1 In-App Admin Surface

1. No in-app Mood admin UI in CTF scope.
2. No plugin-admin web/mobile route parity is required for Mood in this rewrite.

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface

1. `mood.check.submit`
2. `mood.check.eligibility.fetch`

### 3.2 HTTP Projection Routes

User routes (authenticated):

- `POST /api/mood/checks`
- `GET /api/mood/checks/eligible`

Excluded route groups:

1. No `/api/mood/announcements*` routes in CTF rewrite scope.
2. No `/api/mood/admin*` routes in CTF rewrite scope.

## 4) Data Model and Storage Contracts

### 4.1 Mood Checks

1. Mood checks store `clientId`, `moodValue`, and check timestamp metadata.
2. Mood values are validated as integer range `1..5`.
3. Eligibility evaluation is derived from last check timestamp per `clientId`.

## 5) Security, Privacy, and Compliance Controls

1. Auth required for all Mood API routes.
2. Server-side validation on every submission and eligibility request.
3. Logs/diagnostics enforce data minimization and avoid unnecessary request metadata.
4. Anonymous persistence contract is maintained by storing mood values under `clientId` instead of `user_id`.

## 6) Web and Android Parity Plan

1. Mood check route/entry, eligibility behavior, and submission outcomes must match between web and Android.
2. Cooldown and validation semantics must match between web and Android.
3. No Mood admin parity obligations in web/mobile for this rewrite scope.

## 7) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

## 8) Gaps and Known Technical Debt

1. Anonymous `clientId` persistence behind authenticated routes is governed by an implicit policy; explicit user-facing wording on anonymity expectations is a known follow-up.
2. Multi-device behavior (multiple `clientId`s for one authenticated user) is allowed by current schema; no UI affordance to reconcile or merge mood history across devices.

## 9) Change Log

- 2026-05-18: Renamed "Gaps, Ambiguities, and Known Debt (Planning)" to canonical "Gaps and Known Technical Debt" per Rule 120.
- 2026-02-25: Created initial Mood CTF rewrite inventory.
