# Recurring Activity Plugin Feature Inventory (CTF)

## Scope and Boundary

- Plugin name: `Recurring Activity`
- Plugin slug / service key: `recurring-activity`
- Owned surfaces: `/api/recurring-activity/*` routes, `recurring_activities` + `recurring_activity_audit_trail`
  tables, `packages/mobile/src/features/recurring-activity` (Android), `components/recurring-activity/*`
  and `/apps/recurring-activity` (web), and the internal `RACT` counting unit in the `currencies` catalog.
- Not owned: canonical user profile (Directory), identity (Clerk), the currency catalog itself
  (`currencies` — read-only here), the ServiceCredits ledger (never touched), and GDP/Trust (this plugin
  is a read source they consume).

## Intent and Outcome

Capture recurring peer relationships — an ongoing rent, an ongoing service, a standing favor — WITHOUT
turning the platform into a payment processor or holding a recurring-payment record. Origin: issue #885
(recognize ongoing LightHouse rent in GDP) generalized by the owner into one dedicated plugin so that
**recurring** activity is captured in exactly one isolated place, cross-referenceable by GDP and Trust,
and never selectively tracked inside individual marketplace plugins (which would risk crossing into
third-party financial-reporting territory and compromise the peer-to-peer marketplace posture).

A member declares "I have an ongoing activity with this member" using only fixed dropdowns; the other
member confirms; and from then on the activity is counted — by **number** for fiat, by **declared
value** for ServiceCredits — into the GDP Community Value Index, and as a distinct-counterparty breadth
signal in Trust. It is emphatically NOT a ledger, NOT a bill, and carries NO fiat amount.

### The two firewalls that make this safe

1. **No free-text.** There is no note/description field anywhere — a vulnerable population must not be
   able to over-disclose an auditable detail in free text. The fixed `sector` dropdown is the whole
   "description."
2. **No fiat amount, ever.** A fiat-denominated activity stores only the currency label + cadence, never
   a number. The platform therefore never holds a summable recurring-fiat-payment total — the thing that
   would look like money transmission. Only ServiceCredits (an internal utility token with no third-party
   reporting duty) carries a declared value, and even that is a declared figure, never an executed
   transfer, so it never touches real balances or the SC ledger.

## User Features

1. Declare a new recurring activity with another member (owner side): counterparty + sector + currency +
   cadence, plus an optional ServiceCredits value only when the currency is ServiceCredits. Created as
   `pending`.
2. Confirm or decline a pending activity another member recorded with you (counterparty side). Only a
   confirmed (`active`) activity counts toward Trust or GDP.
3. End an ongoing activity you are part of (either party), so the index reflects reality.
4. Control the visibility (private default / restricted / public) of an activity you recorded.
5. See your ongoing activities and pending confirmations in the hub, and via a light card in the account
   hub next to Trust.

## Admin Features

None in v1. There is no admin mutation surface. The append-only `recurring_activity_audit_trail`
supports later admin review of the bilateral confirmation graph for collusion patterns (a ring that only
ever confirms the same small set of members), which is one of the fraud signals this plugin is designed
to make detectable — but no admin UI ships yet (see Gaps).

## API Surface and Route Map

All routes are authenticated-only (`evaluatePluginAccess`), self/party-scoped, and every mutation
requires the same-origin CSRF header (`x-ctf-csrf: 1`) and writes an audit row.

- `GET /api/recurring-activity` — the caller's own activities (both sides), newest first, with the other
  party's display name resolved. Command: `recurring-activity.list.read`.
- `POST /api/recurring-activity` — declare a pending activity. Rejects a self-counterparty, an unknown or
  inactive currency, and a fiat line carrying an amount. Command: `recurring-activity.create`.
- `POST /api/recurring-activity/[activityId]/confirm` — counterparty confirms (pending → active).
  Command: `recurring-activity.confirm`.
- `POST /api/recurring-activity/[activityId]/decline` — counterparty declines (pending → declined).
  Command: `recurring-activity.decline`.
- `POST /api/recurring-activity/[activityId]/end` — either party ends (→ ended). Command:
  `recurring-activity.end`.
- `POST /api/recurring-activity/[activityId]/visibility` — owner sets visibility. Command:
  `recurring-activity.visibility.update`.

## Data Model and Storage Contracts

- `recurring_activities` — one row per declared peer activity. Columns: `id` UUID PK; `owner_user_id`
  TEXT (declarer); `counterparty_user_id` TEXT; `sector` TEXT CHECK (`housing`|`service`|`favor`|
  `general`, default `general`) — the fixed "description"; `currency_code` TEXT FK → `currencies.code`;
  `cadence` TEXT CHECK (`weekly`|`biweekly`|`monthly`|`quarterly`, default `monthly`); `sc_value`
  NUMERIC(14,2) nullable — set ONLY for ServiceCredits lines, always NULL for fiat; `status` TEXT CHECK
  (`pending`|`active`|`ended`|`declined`, default `pending`); `visibility` TEXT CHECK
  (`private`|`restricted`|`public`, default `private`); `confirmed_at`, `ended_at`, `ended_by_user_id`,
  `created_at`, `updated_at`. Constraint `recurring_activities_no_self` (`owner_user_id <>
  counterparty_user_id`). Indexes on `(owner_user_id, status)`, `(counterparty_user_id, status)`,
  `(status, currency_code)`. There is deliberately NO free-text column.
- `recurring_activity_audit_trail` — append-only audit of every mutation (create/confirm/decline/end/
  visibility) and denied attempts. Columns: `id` UUID PK, `actor_user_id`, `command`, `policy_status`,
  `reason`, `activity_id`, `request_id`, `trace_id`, `metadata` JSONB, `created_at`. `trace_id` is the
  distributed-trace correlation id required by the audit contract, distinct from `request_id`. Only
  coarse metadata (sector, currency code, cadence, status transition) — no sensitive raw payload. Every
  allow-or-deny decision writes a row, including bad-payload 400s rejected at the route layer.
- `currencies.RACT` — a hidden (`is_active = FALSE`, `kind = 'activity'`, `requires_amount = FALSE`)
  catalog row: the internal counting unit each confirmed fiat recurring activity contributes to the GDP
  index. Never member-selectable (selectors filter `is_active = TRUE`) and never stored on a
  `recurring_activities` row; it exists only as an FK-valid anchor for its contribution weight in
  `currency_usd_rates` (seeded weight 1). The `currencies_kind_check` constraint was widened to allow
  `activity`.

### Lifecycle and counting semantics

- Only `active` (counterparty-confirmed) rows feed Trust or GDP. `pending`, `declined`, and `ended` rows
  feed nothing.
- GDP (see the GDP inventory §4.4): fiat lines → one `RACT` each (a count); ServiceCredits lines → their
  declared `sc_value` (value). Its own de-duped recognition bucket, so it never double-counts the direct
  ServiceCredits transfer source (a different table).
- Trust (see the Trust inventory): the count of DISTINCT other members with an `active` activity (either
  side) — distinct counterparties so a repeated partner or a collusion ring cannot inflate the signal.

## Security, Privacy, and Compliance Controls

- Authentication on every route; self/party-scoped mutations (owner declares; counterparty confirms/
  declines; either party ends; owner sets visibility).
- CSRF confirmation header + same-origin check on every mutation.
- Private by default; only coarse aggregate counts ever reach public surfaces (Trust breadth signal, GDP
  count/value). The fiat/ServiceCredits value is never shown to anyone but the two parties, and no
  counterparty identity is ever surfaced as public evidence.
- No free-text is accepted or stored — the disclosure-risk firewall.
- No fiat amount is accepted or stored — the money-transmission firewall (enforced server-side in
  `createRecurringActivity`, not just the UI).
- Full audit trail (allow + deny) with no sensitive raw payload.

## Web and Android Delivery Status

`web + mobile-responsive + android` — see the change log for the delivery pass. Web hub at
`/apps/recurring-activity`; Android feature at `packages/mobile/src/features/recurring-activity`. Both
bind to the same API and enforce the no-amount-for-fiat rule.

A signed-out visitor (or a signed-in member not verified yet) now sees the marketing landing shell
(`recurring-activity-public-shell.tsx`) at `/apps/recurring-activity` instead of being redirected to
sign-in — matching every other plugin, so the URL is shareable. The shell shows only static preview
copy (no per-user data, per rule 126) and a sign-in / "Finish verifying" call-to-action.

## Seed Coverage Status

`ctf/scripts/seedRecurringActivityPhase0.mjs` (`pnpm --dir ctf seed:recurring-activity`) seeds three demo
rows with deterministic UUIDs: one confirmed fiat housing tie (USD, no amount), one confirmed
ServiceCredits service tie (50 SC/month), and one pending fiat favor tie — covering the hub, the confirm
flow, the Trust signal, and both GDP recognition branches. RACT's contribution weight is seeded by
`seedCurrencyUsdRates.mjs` (weight 1).

## Gaps and Known Technical Debt

1. **Contextual "Is this ongoing?" prompts** inside the sibling plugins where a relationship already
   exists (LightHouse match, Foundation thread, SocketRelay favor, a ServiceCredits send) are the owner's
   intended primary entry point. They must be added surgically/additively to already-shipped screens and
   are a fast follow-up; v1 ships the standalone hub + account-hub card and the full backend.
2. **Cadence is not normalized** for the ServiceCredits value contribution — the declared `sc_value` is
   summed as-is regardless of cadence (a `weekly` 50 SC and a `monthly` 50 SC both contribute 50). A
   monthly normalization is a documented follow-up; the figure is a labeled estimate, so this is an
   approximation, not a correctness bug.
3. **Counterparty existence is not verified** against a canonical member table at create time (the schema
   guards only against a self-counterparty). The UI supplies a real user id from a picker; a server-side
   membership check is a follow-up.
4. **No admin collusion-review surface yet** — the bilateral graph is captured (owner/counterparty edges
   + cadence + audit trail) so the "same small group confirming each other to inflate trust" pattern is
   detectable, but the admin view/metric that surfaces it is not built.

## Change Log

- 2026-07-14: Added refresh controls (app-wide refresh rollout). Web: the shared `RefreshButton` now
  sits next to the "Recurring Activity" heading (the shell renders one header for both the desktop
  and mobile-responsive layouts), wired to a new background mode of `loadData` so the activities and
  currencies re-pull without the full-screen loading state. Android: native pull-to-refresh via
  `RefreshControl` on the `RecurringActivity` screen's `ScrollView`, wired to a new background
  variant of `load`. UI-only; no schema, route, or contract change.
- 2026-07-04: Plugin created (issue #885). Added `recurring_activities` + `recurring_activity_audit_trail`
  to `schema.sql`, the hidden `RACT` counting unit (+ widened `currencies_kind_check` to allow
  `activity`) and its seeded weight; the `lib/recurring-activity/*` repository/API library; the six API
  routes; `seedRecurringActivityPhase0.mjs`; the plugin registry row (fallback + `ctf_plugin_registry`
  seed, nav rank 240); the four contract files; the account-deletion registry entry; the GDP recognition
  source (`recurringActivitySource` in `recognition.ts` + `recognizeGdp.mjs`, fiat-by-count/SC-by-value);
  and the Trust distinct-counterparty signal (`recurringActivityCounterparties`, model bumped to
  `cross_plugin_engagement_v4`). Web hub + Android feature delivered. This closes issue #885: recurring
  off-platform relationships (LightHouse rent and the rest of the "settles later" bucket) are captured
  here as self-declared, confirmed activities rather than via a per-plugin settlement table, so no
  recurring fiat amount is ever stored.
- 2026-07-04: Added the signed-out public landing shell (`recurring-activity-public-shell.tsx`) and
  registered it in `public-visitor-registry.tsx`. The dedicated `/apps/recurring-activity` route now
  renders it for an unauthenticated visitor (or a not-yet-verified member, with a "Finish verifying"
  CTA) instead of redirecting to sign-in, so the URL is shareable and consistent with the other
  plugins' public views. Marketing copy only — no per-user data (rule 126).
- 2026-07-14: Code-review fixes (issues #1493–#1500). Added the `trace_id` column to
  `recurring_activity_audit_trail` and a `traceId` parameter to the audit writer so every audit row
  carries the contract-required trace id. The create route now writes a deny audit row for each
  bad-payload 400 rejected at the route layer (previously only repository-level validation failures were
  audited). Repository: `createRecurringActivity` now rejects `scValue <= 0` (zero was accepted before);
  `setRecurringActivityVisibility` now rejects visibility changes on ended/declined activities and
  returns a clean not-found if the row disappears between the ownership check and the UPDATE. Mutation
  responses now include the reader-scoped `role`. UI parity: the mobile card now offers "End" for
  pending activities (not just active), the web item hides the visibility picker unless the activity is
  active, and the web counterparty picker waits for two typed characters before querying the directory.

- [x] Schema tables + hidden RACT counting unit (`schema.sql`).
- [x] Contract files (command / access-policy / audit / deletion).
- [x] Repository + API routes (list/create/confirm/decline/end/visibility) with CSRF + audit.
- [x] Seed script with deterministic UUIDs.
- [x] Plugin registry entry (fallback + DB seed).
- [x] GDP recognition source (fiat by count, SC by value, own bucket).
- [x] Trust distinct-counterparty signal (model bump + contract dataAccess).
- [x] Account-deletion registry entry.
- [x] Web hub + page (desktop + mobile-responsive).
- [x] Android feature + parity contract entry.
- [ ] Contextual create prompts embedded in sibling plugins (fast follow-up — see Gaps #1).
- [ ] Admin collusion-review surface (follow-up — see Gaps #4).
