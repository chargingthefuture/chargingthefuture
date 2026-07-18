# Contributor Access Module Feature Inventory (CTF)

## Scope & Boundary

- Module name: `Contributor Access`
- Module slug / service key: `contributor-access`
- First slice of the trusted-channel / contributor-badge system described in
  `ctf/docs/developer/TRUSTED_CHANNELS_AND_CONTRIBUTOR_BADGE_PROPOSAL.md`. The badge's working name
  ("Keeper of the Commons") appears only in doc comments — there is no member-facing copy in this
  slice.
- Hard boundary: this module **never touches the Trust plugin** — no reads or writes of any
  `trust_*` table, no imports from `ctf/packages/web/lib/trust/`. It reads other plugins' value
  tables to make an access decision and owns its own storage.
- No Stream/GetStream code in this slice (the gated channel is a later slice).

## Intent

Compute one categorical decision per member — **eligible** or **not-yet** — from real material
value delivered to real people, so the platform can later grant a contributor badge and access to a
single gated channel. The score behind the decision is internal only and is never surfaced to
anyone as a number: standing is categorical, with no points, tiers, leaderboard, or ranking on any
surface. Eligibility is additive (the recompute only ever admits) and permanent once earned;
removal is for-cause only via an admin action.

## Target User Features

**None in this slice.** There is no member surface: the Directory badge, the "how it's earned"
page, and the gated channel itself are later slices — see the proposal document
(`TRUSTED_CHANNELS_AND_CONTRIBUTOR_BADGE_PROPOSAL.md`) for the full plan and its hard guardrails.

## Target Admin Features

1. Eligible-members list (user id, username, first-earned date, revoke flag) with for-cause
   revoke (non-empty reason required, confirm before it lands) and reinstate.
2. Config editor for the owner-tunable eligibility rules: score threshold, minimum account age,
   minimum distinct plugins, minimum distinct counterparties, the eligible-member minimum required
   before the gated channel opens, and per-event weights over the fixed value-event key list. The
   channel-open toggle is shown disabled — the channel ships in a later slice.
3. Channel launch status card: eligible count vs `min_eligible_to_open_channel`.
4. Admin page `/admin/contributor-access` (server-side admin gate; non-admins redirect to
   `/apps`), rendering `components/contributor-access/contributor-access-admin-shell.tsx` with
   loading/empty/error/populated states and the mobile-responsive `MobileScreenHeader` layout.

## API Surface and Route Map

Admin routes (admin-only via `requireContributorAccessAdmin`; every allow **and** deny writes a
`contributor_access_audit_trail` row; mutations additionally require the `x-ctf-csrf: '1'` header):

- `GET /api/contributor-access/admin/config` — the single config row (defaults when never
  written); audits `contributor-access.config.get`.
- `PUT /api/contributor-access/admin/config` — update weights/threshold/minimums/channel_open
  (weight keys are validated against the fixed value-event key list); audits
  `contributor-access.config.update`.
- `GET /api/contributor-access/admin/eligible` — members who earned eligibility (user id, username
  via the `users` table, `first_earned_at`, revoke flag/reason) plus the current eligible count.
  **Never any score.** Audits `contributor-access.eligible.list`.
- `POST /api/contributor-access/admin/revoke` — body `{ userId, reason }`; for-cause only, reason
  must be non-empty; sets `revoked_for_cause` and turns `eligible` off; audits
  `contributor-access.member.revoke`.
- `POST /api/contributor-access/admin/reinstate` — body `{ userId }`; clears the revocation and
  restores `eligible` (it was previously earned — `first_earned_at` is permanent); audits
  `contributor-access.member.reinstate`.

Internal (service-to-service, never member/browser callable):

- `POST /api/internal/contributor-access/recompute` — runs `computeEligibility()`; guarded by
  `Authorization: Bearer INTERNAL_SERVICE_SECRET` (501 when unset, 401 on a bad token); returns
  `{ ok, evaluated, eligible }` counts only. Called weekly (Mondays 06:30 UTC) by
  `.github/workflows/contributor-access-recompute.yml`. Contract:
  `contributor-access.eligibility.recompute`.

## Data Model and Storage Contracts

Owned tables in `ctf/schema.sql` (all guarded `CREATE TABLE IF NOT EXISTS` + per-column
`ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`; `schema.demo.sql` regenerated):

- `contributor_access_config` — single row (`id` INT fixed to 1 by CHECK): `weights` JSONB
  (per value-event-key overrides of the engine defaults; missing key falls back), `threshold`
  NUMERIC (default 100), `min_account_age_days` INT (default 90), `min_distinct_plugins` INT
  (default 3), `min_counterparties` INT (default 5), `min_eligible_to_open_channel` INT
  (default 10), `channel_open` BOOLEAN (default FALSE — forward-looking, nothing grants access from
  it yet), `updated_at`.
- `contributor_access_eligibility` — one row per evaluated member: `user_id` TEXT PK, `eligible`
  BOOLEAN, `first_earned_at` TIMESTAMPTZ NULL (set once, never cleared), `reason_snapshot` JSONB
  (internal evidence: score, per-event counts, gates — **never exposed to members**),
  `computed_at`, `revoked_for_cause` BOOLEAN, `revoked_reason` TEXT NULL, `revoked_at` NULL,
  `revoked_by` NULL. Index on `(eligible, first_earned_at)`.
- `contributor_access_audit_trail` — same shape as `weekly_performance_audit_trail`: `id`,
  `actor_id`, `command`, `policy_status`, `reason`, `target_type`, `target_id`, `metadata` JSONB,
  `created_at`.

Upstream reads (engine only, `ctf/packages/web/lib/contributor-access/`): the same tables and
fixed filters as `lib/weekly-performance/live-metrics.ts`, all-time and grouped per the member who
delivered the value — `foundation_call_sessions` (callee), `socket_relay_fulfillments`
(fulfiller), `trust_transport_trips` (provider), `lighthouse_matches` (host),
`service_credits_transfers` (sender; chyme tips and direct sends separately by `origin_plugin`),
`contributions_submissions` (USD sum per contributor), `skills_hunt_submissions` (submitter),
`what_works_products` (suggested_by) / `what_works_endorsements` (user), `level_up_enrollments`
(learner) / `level_up_disbursements` (trainer), `recurring_activities` (both sides of an active
confirmed tie), `peer_programming_messages` (author, once per distinct week), `beacon_events` +
`feed_community_post_reactions` + `feed_community_replies` (distinct broadcasts engaged), and
`login_events` (first login = account-age anchor). Every query is table-existence-guarded and
never throws; a missing table contributes nothing.

Counterparty diversity reads the two-sided events' real counterparty columns:
`service_credits_transfers` (`sender_user_id`/`recipient_user_id`), `trust_transport_trips`
(`requester_user_id`/`provider_user_id`), `socket_relay_fulfillments`
(`requester_user_id`/`fulfiller_user_id`), `lighthouse_matches` (`seeker_user_id`/`host_user_id`),
`recurring_activities` (`owner_user_id`/`counterparty_user_id`). Foundation call sessions are
deliberately excluded from the diversity read to minimize access to the sensitive table (their
counts still feed the score internally).

## Security, Privacy, and Compliance Controls

- **Categorical flag only — no score is ever surfaced**, to members or admins. The internal score
  and per-event counts live only in `reason_snapshot`, which no API returns (the admin eligible
  list carries id/username/date/flags only). Proposal hard guardrail.
- **Foundation per-member counts are internal-only** (rule 132 — sensitive wellbeing/payment
  participation): computed as gating fuel, never exposed on any surface.
- **Never touches the Trust plugin** — no `trust_*` table reads/writes, no `lib/trust/` imports.
- Admin-only access (`requiredRoles [admin]`; the `operations` role is not admitted); server-side
  gate on the page (redirect to `/apps`) and on every route; CSRF header + origin check on all
  mutations; every allow/deny audited to `contributor_access_audit_trail`.
- Recompute is internal-secret gated (`INTERNAL_SERVICE_SECRET` bearer), additive only, and
  responds with counts only.
- Revocation is for-cause only (a reviewed harm/abuse action) with a required reason — never for
  inactivity, never on an unreviewed report alone.
- Contracts: `ctf/docs/contracts/CONTRIBUTOR_ACCESS_PLUGIN_COMMAND_CONTRACTS.yaml`,
  `CONTRIBUTOR_ACCESS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`,
  `CONTRIBUTOR_ACCESS_PLUGIN_AUDIT_CONTRACTS.yaml`. No deletion contract yet: the module stores
  only the derived eligibility row and audit rows; a profile-deletion contract lands with the
  member-facing slice.

## Web and Android Delivery Status

Web admin only (`/admin/contributor-access`, desktop + mobile-responsive). Android: not applicable
in this slice — there is no member surface, and admin surfaces are web-first. PRs for this module
use `Parity Status: web + mobile-responsive + android complete` (backend + web-admin-only change)
until a member surface exists.

## Seed Coverage Status

No seed script. The engine reads upstream tables that the existing plugin seeds populate
(`seed:demo`); the owned tables start empty and fill on the first recompute / config save. A
dedicated seed becomes worthwhile with the member-facing slice.

## Gaps & Known Technical Debt

- Badge slice not built: Directory badge, click-through copy, and the "how it's earned" page are a
  later slice (brand-voice pass required; badge name unconfirmed — "Keeper of the Commons" is a
  working name only).
- Channel slice not built: the gated Stream channel, membership sync from the flag, and the
  `channel_open` behavior are a later slice; the toggle is stored but nothing reads it to grant
  access.
- Default weights need owner tuning: the shipped `DEFAULT_WEIGHTS` are a reasoned starting point
  (rare/large actions weigh more), but the proposal defers the real calibration and threshold to
  the owner; the bar is meant to be deliberately high.
- Clean-standing gate is partial: revoked-for-cause is enforced, but active blocks/safety reports
  are not yet read as an admission gate (needs an owner decision on which signals count).
- No per-member admin drill-down (deliberate for now — it would tempt exposing the internal
  evidence; revisit only with strong cause).

## Change Log

- 2026-07-18 — First slice: schema (config / eligibility / audit tables), the eligibility engine
  (fifteen per-member all-time value-event counts mirroring Weekly Performance, weighted score,
  age/plugin-spread/counterparty gates, additive-only recompute), internal recompute route + weekly
  workflow, admin routes (config get/update, eligible list, revoke, reinstate), the admin page and
  shell, contracts, and this inventory.

## Build Checklist

Ordered, dependency-based task list for this module (each item names what blocks it):

1. Schema tables in `ctf/schema.sql` + demo schema regeneration — no dependencies. **Done.**
2. Eligibility engine (`lib/contributor-access/`) — blocked by 1. **Done.**
3. Internal recompute route + scheduled workflow — blocked by 2. **Done.**
4. Admin routes (config, eligible, revoke, reinstate) with audit coverage — blocked by 1. **Done.**
5. Admin page + shell (`/admin/contributor-access`) — blocked by 4. **Done.**
6. Contracts + inventory + manual test script — blocked by 3, 4, 5. **Done.**
7. Owner pass on weights/threshold/minimums via the config editor — blocked by 5; owner decision.
8. Badge slice (Directory badge, click-through copy, "how it's earned" page) — blocked by 7 and
   the owner's badge-name/wording decisions.
9. Channel slice (gated Stream channel type, membership sync from the flag, moderator read-in
   disclosure, launch gate on `min_eligible_to_open_channel`) — blocked by 7; independent of 8.
10. Clean-standing admission gate (blocks/safety reports) — blocked by an owner decision on which
    signals count; can land any time after 2.
