# Directory Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target: `ctf/`
- Plugin slug: `directory`
- Directory is a deterministic profile-and-discovery plugin with unified user/admin UI surface and role-gated server controls.
- Legacy `platform/` is reference-only; not modified.

## Intent and Outcome

Directory in CTF provides authenticated users with a deterministic profile-and-discovery experience, unified admin workflows on the same UI surface, server-enforced policy controls (claimed/unclaimed guardrails, privacy filters, anti-scraping), and parity-safe delivery across web and Android.

## Target User Features

1. Authenticated dashboard/profile experience for create, update, and delete profile operations.
2. Directory list and profile discovery experience for authenticated users.
3. Public profile controls (`isPublic`) and deterministic profile visibility outcomes.
4. Public directory projection routes for unauthenticated list/detail consumption.
5. Announcement consumption in user-visible contexts.
6. Deterministic validation limits for description, selectors, and URL fields.

## Target Admin Features

1. Admin controls are embedded in the same Directory UI surface with role-gated visibility.
2. Admin profile list, create, update, assign, and unclaimed-only delete flows.
3. Admin announcement list/create/update/deactivate flows.
4. Admin skills compatibility and selector governance operations.
5. Claimed/unclaimed guardrails enforced as hard server-side policy constraints.

## API Surface and Route Map

Implemented routes:

- User/authenticated:
  - `GET /api/directory/profile`
  - `POST /api/directory/profile`
  - `PUT /api/directory/profile`
  - `DELETE /api/directory/profile`
  - `GET /api/directory/list`
  - `GET /api/directory/skills`
  - `GET /api/directory/sectors`
  - `GET /api/directory/job-titles`
  - `GET /api/directory/announcements`
- Public:
  - `GET /api/directory/public`
  - `GET /api/directory/public/:id`
- Admin:
  - `GET /api/directory/admin/profiles`
  - `POST /api/directory/admin/profiles`
  - `PUT /api/directory/admin/profiles/:id`
  - `PUT /api/directory/admin/profiles/:id/assign`
  - `DELETE /api/directory/admin/profiles/:id`
  - `GET /api/directory/admin/announcements`
  - `POST /api/directory/admin/announcements`
  - `PUT /api/directory/admin/announcements/:id`
  - `DELETE /api/directory/admin/announcements/:id`

## Data Model and Storage Contracts

1. `directory_profiles` — Directory profile records with claimed/unclaimed state.
2. `directory_announcements` — Directory announcements with activation/deactivation state.
3. Skills hierarchy (shared taxonomy) — Selector-backed taxonomy data.
4. Profile policy contracts — Claimed/unclaimed state and assignment constraints.
5. Public projection contracts — Privacy-filtered output shape for unauthenticated callers.

## Security, Privacy, and Compliance Controls

1. Server-side authorization is enforced on every admin endpoint.
2. Admin controls are hidden in the frontend but authorization is always server-enforced (presentation-only hiding is not authorization).
3. Claimed/unclaimed mutation guardrails are enforced server-side.
4. Public projection returns privacy-minimized fields only.
5. Public endpoints enforce anti-scraping controls and rate-limited access.
6. CSRF protection is required on every write endpoint.
7. Audit logging is required for admin mutations (allow and deny outcomes).

## Web and Android Delivery Status

Parity status: **web+android complete**.

Web and Android implementations:
- User authentication and profile management flows reach parity.
- Admin role-gated controls reach parity (same policy outcomes and deny taxonomy across platforms).
- Unified UI contract governs both clients, with platform-specific presentation only.

## Seed Coverage Status

Deterministic Directory seed script exists: `ctf/scripts/seedDirectoryPhase0.mjs`.

Seeded content:
- Sample authenticated user profiles with claimed/unclaimed states.
- Sample admin profiles (unclaimed).
- Sample announcements.

## Gaps and Known Technical Debt

1. Admin skills compatibility strategy when shared skill deletions affect historical profile data is informally decided; consider explicit codification if additional plugin migrations depend on this constraint.
2. Route ownership policy for announcement APIs (explicit boundary enforcement) is implemented via plugin policy gate, not yet formalized in separate module documentation.

## Change Log

- 2026-05-17: Updated inventory to enforce Rule 120 living-snapshot model. Removed Phase language, Planned section headers, and planning-phase ambiguities list. Confirmed web+android complete delivery status. Clarified technical debt (skills compatibility, route ownership codification) as known limitations, not unimplemented features.
- 2026-03-02: Implemented backend and unified web surface (user/admin role-gated sections) with resolved list/pagination/claimed-delete decisions.
- 2026-02-25: Created initial unified Directory CTF rewrite inventory merging user and admin flows into one planned UI surface.
