# Trust Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `Trust`
- Plugin slug: `trust`
- Owned surfaces: `/api/trust/*` routes, `trust_*` tables, `packages/mobile/src/features/trust` (Android), trust evidence panels embedded in profile/directory surfaces (web).
- Not owned: canonical user profile (Directory), identity (Clerk), moderation backend (handled out-of-plugin via Retool tooling).
- Privacy-first model: no numeric trust scores; only evidence panels, verification status, and visibility controls.

## Intent and Outcome

Trust gives users a privacy-respecting evidence panel and verification status on their profile, with admin review/audit and user-controlled visibility (public, private, restricted).

## Target User Features

1. View trust evidence panel and verification status on profile/directory surfaces.
2. Control trust visibility setting (public, private, restricted) for their own profile.
3. Inspect their own trust signal snapshot via `/api/trust/user/self`.

## Target Admin Features

1. Review pending verification requests via `/api/trust/admin/verification`.
2. Update trust status (verified/unverified/flagged) for a target user.
3. All admin trust actions are captured in `trust_admin_audit_trail`.

## API Surface and Route Map

- `GET /api/trust/user/self` — Current user's trust panel data.
- `GET /api/trust/user/[userId]` — Another user's trust panel (subject to visibility setting).
- `PUT /api/trust/visibility` — Update visibility setting for the caller.
- `POST /api/trust/signal/snapshot` — Refresh signal snapshot for the caller (or admin-targeted user).
- `POST /api/trust/admin/verification` — Admin verification review action.

## Data Model and Storage Contracts

- `trust_user_extension` — Per-user extension (user_id, trust_status, trust_evidence, trust_visibility, timestamps).
- `trust_admin_audit_trail` — Audit log (actor_user_id, command, policy_status, reason, target_user_id, request_id, metadata, created_at).

## Security, Privacy, and Compliance Controls

- Server-side authorization on every route.
- Admin-only gate on `/api/trust/admin/*` routes.
- Visibility setting enforced on cross-user reads (`GET /api/trust/user/[userId]`).
- All admin mutations captured in `trust_admin_audit_trail`.
- No raw moderation evidence exposed to non-admin callers.

## Web and Android Delivery Status

`web+android complete`. Web trust evidence panel is embedded into Directory profile surfaces; Android mirrors with `Trust.tsx`, `TrustEvidencePanel.tsx`, `TrustStatusBadge.tsx`, and `TrustVisibilityBadge.tsx` under `packages/mobile/src/features/trust`.

## Seed Coverage Status

Trust does not have a dedicated seed script; trust state is exercised through Directory profile fixtures and admin verification flows in dev.

## Gaps and Known Technical Debt

1. Trust signal snapshot computation is admin-triggered; no automated/scheduled refresh job is wired in.
2. Trust evidence content is rendered from a structured field on `trust_user_extension`; no rich-text schema or attachment storage contract has been published.

## Change Log

- 2026-05-18: Inventory rewritten to enforce Rule 120 living-snapshot model. Removed "future phase" framing and "No mobile implementation yet" entry (Android features exist under `packages/mobile/src/features/trust`). Replaced placeholder command list with actual routes. Removed `trust_signal_snapshots` table (not present in `ctf/schema.sql`). Confirmed `web+android complete`.
- 2026-03-25: Initial inventory created for Trust plugin rewrite MVP.
