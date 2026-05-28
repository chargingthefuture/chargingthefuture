# Trust Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `Trust`
- Plugin slug: `trust`
- Owned surfaces: `/api/trust/*` routes, `trust_*` tables, `packages/mobile/src/features/trust` (Android), trust badge/evidence panels embedded in profile/directory surfaces (web).
- Not owned: canonical user profile (Directory), identity (Clerk), moderation backend (handled out-of-plugin via Retool tooling), and all upstream engagement/participation data (owned by the plugins Trust reads from, e.g. SocketRelay, login/auth, and other activity sources).
- Derived, read-mostly model: Trust owns no primary participation data. It derives a **qualitative** trust signal — never a numeric score — by aggregating engagement/contribution signals from across the platform's seeded plugins (not just Directory), and persists only the per-user extension (status/evidence/visibility) and the admin audit trail.
- Humane-by-design: Trust deliberately avoids reducing a person to a number. It communicates a likelihood/standing badge (e.g. how established and safe a member appears), not a ranked numeric score.

## Intent and Outcome

Trust gives the community a privacy-respecting, **non-numeric** way to gauge how established and safe a member is — i.e. the likelihood that they are a genuine, contributing participant rather than a bad actor — based on the material value and engagement they have contributed across the platform (for example: how often they log in, the number of SocketRelay trades/fulfillments they have completed, and their overall platform engagement). The signal is surfaced as a trust badge plus a supporting evidence panel and verification status on the user's profile. Admins can review/audit, and users control visibility (public, private, restricted).

## Target User Features

1. View their trust badge (qualitative standing, not a number), evidence panel, and verification status on profile/directory surfaces.
2. Control trust visibility setting (public, private, restricted) for their own profile.
3. Inspect their own trust signal snapshot via `GET /api/trust/user/self`.

## Target Admin Features

1. Review pending verification requests via `/api/trust/admin/verification`.
2. Update trust status (verified/unverified/flagged) for a target user.
3. All admin trust actions are captured in `trust_admin_audit_trail`.

## API Surface and Route Map

- `GET /api/trust/user/self` — Implemented. Current user's trust panel data (status, evidence, visibility) from `trust_user_extension`; gated by server-side plugin authz (`evaluatePluginAccess`).
- `GET /api/trust/user/[userId]` — Implemented (read only). Returns another user's trust panel. Visibility/policy enforcement is still a TODO in code, so cross-user reads are not yet gated by the visibility setting.
- `POST /api/trust/visibility` — Stub. Intended to update the caller's visibility setting; currently returns "not yet implemented."
- `POST /api/trust/signal/snapshot` — Stub. Intended to (re)compute the derived trust signal/snapshot by reading engagement stats from the other seeded plugins (e.g. SocketRelay trades, login frequency, platform engagement); currently returns "not yet implemented."
- `POST /api/trust/admin/verification` — Stub. Intended admin verification review action; currently returns "not yet implemented."

## Data Model and Storage Contracts

- `trust_user_extension` — Per-user extension: `user_id`, `trust_status` (default `unverified`), `trust_evidence` (JSONB array, default `[]`), `trust_visibility` (default `public`), `updated_at`. No numeric trust-score column exists; the qualitative signal is derived at read time from cross-plugin engagement, not stored as a number.
- `trust_admin_audit_trail` — Audit log: `id` (UUID), `actor_user_id`, `command`, `policy_status`, `reason`, `target_user_id`, `request_id`, `metadata` (JSONB), `created_at`.
- No `trust_signal_snapshots` table exists. The `TrustSignalSnapshot` type in `lib/trust/types.ts` describes a derived/ephemeral aggregate computed from other plugins, not a stored row.

## Security, Privacy, and Compliance Controls

- Server-side authorization on `GET /api/trust/user/self` via `evaluatePluginAccess`.
- Humane, privacy-respecting signal: Trust never exposes or persists a numeric score, and the badge is derived from aggregate cross-plugin engagement without exposing the underlying per-plugin records to viewers.
- Admin-only gate is the intended control on `/api/trust/admin/*`; the route is currently a stub.
- `logTrustAuditEvent` writes admin mutations to `trust_admin_audit_trail` (used once the admin/visibility routes are implemented).
- No raw moderation evidence is exposed to non-admin callers.
- Known gap: visibility enforcement on `GET /api/trust/user/[userId]` is not yet implemented (TODO in code).

## Web and Android Delivery Status

Web and Android shells delivered; backend command logic pending. Web renders the trust badge, evidence panel, status/visibility badges, the Directory profile panel (`TrustDirectoryProfilePanel.tsx`), and the right-rail card (`TrustRightRailCard.tsx`). Android mirrors with `Trust.tsx`, `TrustEvidencePanel.tsx`, `TrustStatusBadge.tsx`, and `TrustVisibilityBadge.tsx` under `packages/mobile/src/features/trust`, currently rendering mock data (`TODO` real API fetch). Signal derivation, visibility update, and admin verification routes are not yet implemented.

## Directory Integration

Trust's primary user-facing surface is inside the Directory profile: a member's profile shows their trust badge (the qualitative "score"/standing indicator) alongside the Directory-owned profile fields. Trust reads Directory only for identity/profile context; the badge itself is computed from engagement across multiple plugins, not from Directory data.

## Seed Coverage Status

Trust has no dedicated seed script, and none is required. Trust is a derived plugin: it computes its badge/signal by reading engagement stats from the other already-seeded plugins (each plugin, not just Directory) — for example login frequency, the number of SocketRelay trades/fulfillments, and overall platform engagement. Seeding the upstream plugins is therefore sufficient to exercise Trust in dev. Trust adds only the per-user `trust_user_extension` overlay (status/evidence/visibility), for which defaults are applied on first read.

## Gaps and Known Technical Debt

1. Signal derivation is the intended model but not yet wired: `POST /api/trust/signal/snapshot` is a stub, and the read endpoints return only the stored `trust_user_extension` (status/evidence/visibility) without an aggregated cross-plugin signal.
2. `POST /api/trust/visibility` and `POST /api/trust/admin/verification` are stubs ("not yet implemented").
3. `GET /api/trust/user/[userId]` does not yet enforce the visibility setting (TODO in code).
4. Mobile `Trust.tsx` renders mock data pending real API wiring.
5. Trust evidence content is rendered from a structured JSONB field on `trust_user_extension`; no rich-text schema or attachment storage contract has been published.
6. No automated/scheduled refresh job exists for recomputing the derived signal.

## Change Log

- 2026-05-20: Corrected the trust model — Trust derives a **qualitative, non-numeric** trust signal/badge (deliberately not a numeric score, on humane grounds) indicating the likelihood a member is a genuine, safe participant, based on engagement/contribution aggregated across the platform's seeded plugins (e.g. login frequency, SocketRelay trades, overall engagement), not just Directory. This is why Trust needs no seed script of its own (it reads from already-seeded plugins). Documented the Directory integration (badge surfaced on the profile). Fixed the API surface (`POST /api/trust/visibility`, not `PUT`) and marked the snapshot/visibility/admin-verification routes as stubs; corrected delivery status from "web+android complete" to "shells delivered, backend logic pending"; noted the unguarded cross-user read and mobile mock data.
- 2026-05-18: Inventory rewritten to enforce Rule 120 living-snapshot model. Removed "future phase" framing and "No mobile implementation yet" entry (Android features exist under `packages/mobile/src/features/trust`). Replaced placeholder command list with actual routes. Removed `trust_signal_snapshots` table (not present in `ctf/schema.sql`).
- 2026-03-25: Initial inventory created for Trust plugin rewrite MVP.


## Build Checklist


### MVP Completion Checklist

- [x] Profile/deletion contract drafted and registered
- [x] Command, policy, and audit contracts drafted
- [x] Migration SQL for trust tables delivered
- [x] Feature inventory created in required folder
- [ ] Shared Trust React components implemented
- [ ] Right-rail and Directory profile UI surfaces wired up
- [ ] API routes and backend logic for trust commands
- [ ] Policy enforcement and audit logging
- [ ] Seed script for plugin validation (deferred for MVP)
- [ ] Mobile parity (deferred)

### Notes
- All compliance and modularity rules followed per product instructions.
- Update this checklist as features are completed or deferred.
