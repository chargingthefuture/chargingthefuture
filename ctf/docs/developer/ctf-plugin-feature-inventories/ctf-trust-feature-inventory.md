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
- `GET /api/trust/user/[userId]` — Implemented. Returns another member's trust panel, gated by authentication AND the target's `trust_visibility`: `public` is readable by any authenticated, unlocked member; `private` and `restricted` are readable only by the owner (self) or an admin. A blocked viewer receives `403`. A target with no extension row defaults to `public`.
- `POST /api/trust/visibility` — Implemented. Updates the caller's own visibility (`public` | `private` | `restricted`); rejects any other value with `400`; CSRF-guarded; writes a `trust_admin_audit_trail` row. Self-scope only.
- `POST /api/trust/signal/snapshot` — Implemented. Recomputes the caller's trust signal from real cross-plugin engagement (login frequency/recency from `login_events`, completed SocketRelay trades from `socketrelay_fulfillments`, requests opened from `socketrelay_requests`, and ServiceCredits received — distinct payers and undisputed completed transfers from `service_credits_transfers`/`service_credits_disputes`, coarse COUNTs only), persists a `trust_signal_snapshot` row, and refreshes the caller's derived evidence. Never changes `trust_status`. CSRF-guarded; writes an audit row.
- `POST /api/trust/admin/verification` — Implemented. Admin-only (`evaluatePluginAccess({ requiredRoles: ['admin'] })`). Sets a target user's `trust_status` to `verified` or `flagged`, appends an admin evidence item, and writes an audit row. Validates `targetUserId` and `trustStatus` (`400` on bad input). CSRF-guarded.

## Data Model and Storage Contracts

- `trust_user_extension` — Per-user extension: `user_id`, `trust_status` (default `unverified`), `trust_evidence` (JSONB array, default `[]`), `trust_visibility` (default `public`), `updated_at`. No numeric trust-score column exists; the qualitative signal is derived from cross-plugin engagement, not stored as a number. `trust_evidence` is rewritten by the snapshot route (derived items) and appended-to by the admin verification route (one admin item).
- `trust_admin_audit_trail` — Audit log: `id` (UUID), `actor_user_id`, `command`, `policy_status`, `reason`, `target_user_id`, `request_id`, `metadata` (JSONB), `created_at`. Written by the visibility, snapshot, and admin-verification routes.
- `trust_signal_snapshot` — Append-only derived-metrics record: `id` (UUID), `user_id`, `snapshot` (JSONB metric bundle — login*, socketRelay*, serviceCredits*, and the v3 per-plugin participation counts), `snapshot_type` (model version, default `cross_plugin_engagement_v3`), `created_at`. Indexed on `user_id` and `created_at`. Stores raw counts only — never a numeric trust score. User-scoped; deleted on service/account deletion.

## Trust Signal Model (`cross_plugin_engagement_v3`)

Trust derives a **qualitative, non-numeric** signal by counting **real rows** in already-seeded
upstream plugins — it fabricates nothing. The snapshot route (`POST /api/trust/signal/snapshot`)
computes these counts for the caller, persists them to `trust_signal_snapshot`, and turns them into
human-readable evidence items on `trust_user_extension`. Real signals that feed the model:

- **Login frequency/recency** — from `login_events`: distinct login days (`loginDays`), total events
  (`loginEvents`), and the most recent sign-in (`lastLoginAt`). Evidence: "Active on N days".
- **Completed SocketRelay trades** — from `socketrelay_fulfillments`: closed fulfillments where the
  member was the requester or fulfiller (`socketRelayCompletedTrades`). Closing a fulfillment is how
  a SocketRelay exchange is finished, so a `closed` row is a genuinely completed trade. Evidence:
  "Completed N SocketRelay trades".
- **SocketRelay requests opened** — from `socketrelay_requests`: count of requests the member owns
  (`socketRelayRequestsOpened`). Evidence: "Opened N SocketRelay requests".
- **Paid by the community (ServiceCredits)** — from `service_credits_transfers`: distinct members who
  paid this member via a completed transfer (`serviceCreditsDistinctPayers`, counting distinct senders
  so one repeat payer can't inflate it) and the total completed transfers received
  (`serviceCreditsCompletedReceived`). Evidence: "Received ServiceCredits from N community members".
- **Clean ServiceCredits record** — from `service_credits_disputes`: disputes opened against the
  member's received transfers (`serviceCreditsDisputesAgainst`). The clean-record evidence
  ("N completed ServiceCredits transfers, none disputed") is shown only when there are completed
  received transfers and **zero** disputes. A dispute **withholds** this positive signal rather than
  producing a negative badge or a deduction — signal over noise, with dignity. The dispute count is
  kept in the snapshot metrics for the member's own and admin transparency, never surfaced publicly.

- **Per-plugin participation (v3)** — one coarse COUNT each, completed/accepted/claimed states only, so a
  member active in only one plugin is still seen (with less social proof than an all-plugins member, not the
  same). Each emits one categorical "verb N noun" evidence item:
  - LightHouse — `lighthouse_matches` accepted/completed → "Accepted N LightHouse matches"
  - TrustTransport — `trusttransport_trips` completed → "Completed N TrustTransport trips"
  - Skills Hunt — `skills_hunt_submissions` accepted → "Accepted N Skills Hunt submissions"
  - LevelUp — `levelup_enrollments` completed → "Completed N LevelUp cohorts"
  - Chyme — `chyme_room_members` → "Joined N Chyme rooms"
  - Directory — `directory_profiles` (`claimed_by_user_id`) → "Claimed N Directory profiles"
  - WhatWorks — `whatworks_endorsements` → "Endorsed N WhatWorks products"
  - Peer Programming — `peer_programming_cohort_members` → "Joined N Peer Programming cohorts"
  - Contributions — `contributions_submissions` confirmed → "Confirmed N contributions"
  - Foundation (provider side only) — `foundation_connection_threads` where `provider_user_id` = the member → "Connected with N members as a Foundation provider". The **seeker** side (requesting services) is never counted — help-seeking is sensitive.

**Privacy exclusions (by design):** sensitive personal-wellbeing/verification plugins are **not** surfaced
as public trust evidence — **ClickLog** (safety incidents), **Mood** (mental-health check-ins),
**GentlePulse** (wellness), and **Unlock** (survivor-verification approval). Surfacing those would expose
what a member is going through; their activity is still reflected by the universal login signal. Plugins
with no per-member participation (Workforce, Weekly Performance, Feed/Announcements, Skills Taxonomy, GDP)
and Comic (fuzzy completion) are not applicable. **Foundation** surfaces the provider side only (seeker-side help-seeking is excluded for privacy).

Only coarse COUNTs are read (never amounts, balances, or sensitive per-row detail), so no money figure or
private detail crosses into Trust. Real-data-only rule: any signal whose backing rows are absent (count of
0 / no login) produces **no** evidence item, so the panel never claims activity that did not happen. No
numeric score is ever computed or stored. The snapshot route never changes `trust_status` (admin-controlled).

## Security, Privacy, and Compliance Controls

- Authentication on every route via `evaluatePluginAccess` (web Clerk headers or verified bearer token).
- Cross-user read (`GET /api/trust/user/[userId]`) enforces the target's `trust_visibility`: `public`
  = any authenticated member; `private`/`restricted` = owner or admin only. Blocked viewers get `403`.
- Admin-only gate on `POST /api/trust/admin/verification` via `evaluatePluginAccess({ requiredRoles: ['admin'] })`.
- All three mutation routes require the same-origin CSRF confirmation header and reject cross-origin
  mutations.
- Humane, privacy-respecting signal: Trust never exposes or persists a numeric score; evidence is
  built from aggregate counts without exposing the underlying per-plugin records to viewers.
- `logTrustAuditEvent` writes every visibility, snapshot, and admin-verification mutation to
  `trust_admin_audit_trail` with a request id.
- No raw moderation evidence is exposed to non-admin callers.

## Web and Android Delivery Status

**Web: delivered (pixel pass complete).** Web renders the trust badge, evidence panel, status/visibility badges, the Directory profile panel (`TrustDirectoryProfilePanel.tsx`), and the right-rail card (`TrustRightRailCard.tsx`). The right-rail card completed its web pixel pass: it now renders `TrustWidgetCard.tsx`, an inline-styled widget aligned to `design/.../survivor-hub/Trust.tsx` (blue brand palette, ShieldCheck header + Verified/Unverified pill, onboarding steps, static visibility row, real `trustEvidence` list when present). Per the real-data-only rule the design's verified-state signal buckets are omitted (the snapshot route is a stub with no backing table) and the non-functional Request-Verification CTA / visibility dropdown are rendered as truthful static affordances.

**Android: delivered (pixel pass complete — 2026-05-31).** `Trust.tsx` under `packages/mobile/src/features/trust` has been rewritten to align with `design/.../survivor-hub/MobileTrust.tsx`, `MobileTrustEmpty.tsx`, `MobileTrustLoading.tsx`, and `MobileTrustPublic.tsx`. A new `api.ts` binds to `GET /api/trust/user/self` for real data. The screen covers all four states: loading (branded taglines), public/unauthenticated (visitor marketing view), empty (no evidence yet), and populated (evidence list). `MockTrust.tsx` is retired. Real bindings: `trustStatus`, `trustVisibility`, `trustEvidence` array (type/summary/createdAt per item). Omissions per real-data-only rule: Last Active / Activity / Transactions / Active Plugins stats from the design's Trust Score card have no backing API field and are omitted; signal-progress percentage and hardcoded checklist items are omitted (snapshot route is a stub); visibility update dropdown rendered as display-only at the time of the pixel pass. The backend for signal derivation, visibility update, and admin verification is now implemented (2026-06-08); the Android/web clients can be wired to the live mutation routes in a follow-up UI pass.

## Directory Integration

Trust's primary user-facing surface is inside the Directory profile: a member's profile shows their trust badge (the qualitative "score"/standing indicator) alongside the Directory-owned profile fields. Trust reads Directory only for identity/profile context; the badge itself is computed from engagement across multiple plugins, not from Directory data.

## Seed Coverage Status

Trust has no dedicated seed script, and none is required. Trust is a derived plugin: the snapshot route computes its evidence by reading engagement stats from the other already-seeded plugins — login frequency from `login_events`, completed SocketRelay trades from `socketrelay_fulfillments`, and requests opened from `socketrelay_requests`. Seeding the upstream plugins is therefore sufficient to exercise Trust in dev: run `POST /api/trust/signal/snapshot` for a seeded member and the real counts populate `trust_signal_snapshot` and the member's derived evidence. Trust adds only the per-user `trust_user_extension` overlay (status/evidence/visibility), for which defaults are applied on first read, and the `trust_signal_snapshot` history (created on demand by the snapshot route).

## Gaps and Known Technical Debt

1. ~~Signal derivation is the intended model but not yet wired: `POST /api/trust/signal/snapshot` is a stub.~~ Resolved (2026-06-08) — the snapshot route computes real cross-plugin engagement, persists a `trust_signal_snapshot` row, and refreshes derived evidence.
2. ~~`POST /api/trust/visibility` and `POST /api/trust/admin/verification` are stubs.~~ Resolved (2026-06-08) — both implemented, validated, CSRF-guarded, and audited; admin verification is admin-only.
3. ~~`GET /api/trust/user/[userId]` does not yet enforce the visibility setting.~~ Resolved (2026-06-08) — authentication plus `trust_visibility` enforcement (`public` open to members; `private`/`restricted` owner-or-admin only).
4. ~~Mobile `Trust.tsx` renders mock data pending real API wiring.~~ Resolved — Android pixel pass complete (2026-05-31).
5. Trust evidence content is rendered from a structured JSONB field on `trust_user_extension`; no rich-text schema or attachment storage contract has been published.
6. No automated/scheduled refresh job exists for recomputing the derived signal — refresh is on-demand via the snapshot route (a future scheduled job could call the same logic).
7. The model counts engagement but does not yet expose a `member_since` or active-plugin-count signal; those design fields remain omitted per real-data-only until a backing source is wired.

## Change Log

- 2026-06-15: Platform-wide coverage — every applicable plugin now contributes a categorical Trust signal (#538), model `cross_plugin_engagement_v3`. Added 9 per-plugin participation signals (LightHouse, TrustTransport, Skills Hunt, LevelUp, Chyme, Directory, WhatWorks, Peer Programming, Contributions), each a coarse COUNT of completed/accepted/claimed rows emitting one categorical evidence item; the evidence builder is data-driven so the set can grow without complexity. A member active in only one plugin is now represented (with less social proof than an all-plugins member, never the same). Privacy exclusions by design: ClickLog/Mood/GentlePulse/Unlock are not surfaced (sensitive personal-wellbeing/verification — covered by login instead). Foundation deferred (status enum). No numeric score. Bumped `TRUST_SNAPSHOT_MODEL` to v3; extended `TrustSignalMetrics`; updated the command contract (`trust.signal.snapshot.refresh` v1.2.0 + 9 tables added to dataAccess), the deletion contract, and the signal-model section. Added rule `132-trust-signal-coverage-rules.mdc` and a New Plugin Lifecycle Checklist item. No schema change. Web typecheck clean.
- 2026-06-15: Added ServiceCredits contribution signals to the model (`cross_plugin_engagement_v2`). The snapshot now also reads coarse COUNTs from `service_credits_transfers` (completed transfers received + distinct paying members) and `service_credits_disputes` (disputes against received transfers). Two new categorical evidence items: "Received ServiceCredits from N community members" (breadth) and "N completed ServiceCredits transfers, none disputed" (clean record). The clean-record signal is **withheld** when a dispute exists rather than producing a negative badge — signal over noise, with dignity. No amounts/balances are read and no numeric score is produced (reconciles the platform's no-credit/social-score commitment). Bumped `TRUST_SNAPSHOT_MODEL` to `cross_plugin_engagement_v2`; extended `TrustSignalMetrics`; updated command contract (`trust.signal.snapshot.refresh` v1.1.0, added `service_credits_transfers`/`service_credits_disputes` to dataAccess), the deletion contract metric bundle, and the signal-model section. No schema change (the snapshot JSONB absorbs the new fields). Web typecheck clean.

- 2026-06-12: The Android Trust API client (`packages/mobile/src/features/trust/api.ts`) now uses the shared authenticated fetch helper — the call to `GET /api/trust/user/self` carries the signed-in member's Clerk bearer token and the server address comes from runtime config (APP_URL) — replacing plain dev-only fetch against a hardcoded development URL.
- 2026-06-08: Implemented the trust backend (no stubs). `POST /api/trust/signal/snapshot` now computes the caller's signal from real cross-plugin engagement (login frequency/recency from `login_events`, completed SocketRelay trades from `socketrelay_fulfillments`, requests opened from `socketrelay_requests`), persists a `trust_signal_snapshot` row, and rewrites the caller's derived evidence — without changing `trust_status`. `POST /api/trust/visibility` validates against the visibility enum and persists the caller's setting. `POST /api/trust/admin/verification` is admin-only and sets a target's status to `verified`/`flagged` with an appended admin evidence note. `GET /api/trust/user/[userId]` now requires authentication and enforces `trust_visibility` (public open to members; private/restricted owner-or-admin). All mutations are CSRF-guarded and write `trust_admin_audit_trail` rows. Added `trust_signal_snapshot` table (real schema, IF NOT EXISTS pattern) and registered it as a user-scoped delete in the account deletion registry. Reconciled the command/access/audit/deletion contracts to the shipped surface (renamed `trust_signal_snapshots` → `trust_signal_snapshot`; replaced draft bucket fields/roles). Real-data-only: any signal with no backing rows yields no evidence; no numeric score is ever produced.
- 2026-05-31: Android pixel pass. Rewrote `Trust.tsx` to align to `design/.../survivor-hub/MobileTrust.tsx` (and Empty/Loading/Public variants). Added `api.ts` binding to `GET /api/trust/user/self` (real `trustStatus`, `trustVisibility`, `trustEvidence` fields). Retired `MockTrust.tsx`. Omitted per real-data-only: Trust Score stats (Last Active / Activity / Transactions / Active Plugins), signal-progress %, and hardcoded checklist items have no backing API field; visibility update rendered display-only (POST stub). All four states covered: loading, public, empty, populated. EOF, parity, and typecheck gates pass; tsc errors are pre-existing `expo/tsconfig.base not found` constraint only.
- 2026-05-30: Web pixel pass for the right-rail Trust widget. Added `TrustWidgetCard.tsx` (inline-styled, aligned to `design/.../survivor-hub/Trust.tsx`) and wired the shared `TrustRightRailCard` to it; removed the now-unreachable `compact` branch from `TrustEvidencePanel`. Per real-data-only: omitted the design's unbacked verified-state signal buckets (rendering the real `trustEvidence` list instead) and rendered the non-functional Request-Verification CTA / visibility dropdown as truthful static affordances (both backing routes remain stubs). No schema/route/contract changes.
- 2026-05-20: Corrected the trust model — Trust derives a **qualitative, non-numeric** trust signal/badge (deliberately not a numeric score, on humane grounds) indicating the likelihood a member is a genuine, safe participant, based on engagement/contribution aggregated across the platform's seeded plugins (e.g. login frequency, SocketRelay trades, overall engagement), not just Directory. This is why Trust needs no seed script of its own (it reads from already-seeded plugins). Documented the Directory integration (badge surfaced on the profile). Fixed the API surface (`POST /api/trust/visibility`, not `PUT`) and marked the snapshot/visibility/admin-verification routes as stubs; corrected delivery status from "web+android complete" to "shells delivered, backend logic pending"; noted the unguarded cross-user read and mobile mock data.
- 2026-05-18: Inventory rewritten to enforce Rule 120 living-snapshot model. Removed "future phase" framing and "No mobile implementation yet" entry (Android features exist under `packages/mobile/src/features/trust`). Replaced placeholder command list with actual routes. Removed `trust_signal_snapshots` table (not present in `ctf/schema.sql`).
- 2026-03-25: Initial inventory created for Trust plugin rewrite MVP.


## Build Checklist


### MVP Completion Checklist

- [x] Profile/deletion contract drafted and registered
- [x] Command, policy, and audit contracts drafted
- [x] Migration SQL for trust tables delivered
- [x] Feature inventory created in required folder
- [x] Shared Trust React components implemented
- [x] Right-rail and Directory profile UI surfaces wired up
- [x] API routes and backend logic for trust commands
- [x] Policy enforcement and audit logging
- [ ] Seed script for plugin validation (not required — Trust reads from already-seeded plugins)
- [x] Mobile parity (Android pixel pass complete)

### Notes
- All compliance and modularity rules followed per product instructions.
- Update this checklist as features are completed or deferred.
