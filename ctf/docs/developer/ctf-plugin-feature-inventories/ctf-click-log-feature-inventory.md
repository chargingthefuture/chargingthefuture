# ClickLog Plugin Feature Inventory

## 1. Scope & Boundary

ClickLog provides a simple, auditable incident counter and logging system for users, supporting optional location and notes metadata. It is designed for event tracking, user journaling, and lightweight incident reporting.

## 2. Intent & Outcome

- Allow users to log incidents with a single tap/click
- Optionally capture geolocation and notes
- Display a running count and history
- Support deletion and auditability

## 3. User Features

- Log incident (with optional location/notes)
- View incident count and history
- Delete own incidents
- Mobile and web parity

## 4. Admin Features

- View all incidents (future)
- Delete any incident (future)

## 5. API Surface and Route Map

- `GET /api/click-log` — List incidents for authenticated user. Returns `{ incidents, count }`. The user is always derived from the authenticated token (no caller-supplied `userId`); the access policy (`canViewIncidents`) is applied before the query.
- `POST /api/click-log` — Create incident. Returns the created incident flat (a `ClickLogIncident`, not wrapped under `{ incident }`), matching the command contract's `outputSchema`.
- `DELETE /api/click-log/[id]` — Delete incident by id. Returns `{ success: true }`.

## 6. Data Model and Storage Contracts

- Table: `click_log_incidents`
  - `id UUID PRIMARY KEY`
  - `user_id TEXT`
  - `metadata JSONB NOT NULL DEFAULT '{}'` (latitude, longitude, notes)
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Indexes: `user_id`, `created_at DESC`

## 7. Security, Privacy, and Compliance Controls

- Auth required for all actions
- Users can only view/delete their own incidents; admins can view/delete any incident
- Web and mobile mutations send the `x-ctf-csrf: 1` header
- Every authorized operation emits an audit event (`click-log.incident.create`/`.list`/`.delete`)
  via `lib/click-log/audit.ts`, matching [CLICK_LOG_PLUGIN_AUDIT_CONTRACTS.yaml](../../contracts/CLICK_LOG_PLUGIN_AUDIT_CONTRACTS.yaml).
  The delete route emits a `failure`-result event when an authorized delete finds no row (rowCount 0),
  so an authorized request is audited regardless of the storage outcome.
- See [CLICK_LOG_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml](../../contracts/CLICK_LOG_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml)

## 8. Web and Android Delivery Status

- Web (desktop + mobile-responsive): Implemented shell, complete
- Android (React Native): **surface removed 2026-07-20 (rule 105, PR #1742)** — this feature is now web-only, served by the installable web app (PWA)
- See [plugin-parity-contracts.json](../../../config/plugin-parity-contracts.json)

Web pixel pass (design `c5d83c0`): `ClickLogShell` is rebuilt to `design/.../survivor-hub/ClickLog.tsx`
and its Empty/Loading states. The plain shell was replaced with the mockup's dark (`#0F1117` / brand
`#E91E8C`) layout — icon rail, sidebar (total + this-week strip + encryption note), the large circular
"Log Incident" button with an inline note form, the recent-incidents list, and the right-rail stats +
safety reminder — decomposed into modular sub-components within the rule-116 limits. All counters
(total, this-week weekday strip, this-week/this-month/with-notes/with-location stats) are derived from
the real `/api/click-log` data; none are dummy. The note form posts to `/api/click-log` (optional
geolocation via the browser), delete calls `DELETE /api/click-log/:id`. ClickLog is a private, auth-only
tool, so there is no public state (the `ClickLogPublic.tsx` mockup is not implemented by design). The
Android pixel pass to `MobileClickLog.tsx` remains tracked in `PRODUCTION_READINESS_PLAN.md`.

## 9. Seed Coverage Status

- See [scripts/seedClickLog.mjs](../../../scripts/seedClickLog.mjs)
- 3–5 sample incidents with varied metadata

## 10. Gaps and Known Technical Debt

- No admin UI for global view/delete; admin access is via direct DB tooling.
- No rate limiting on incident creation beyond shared platform defaults.
- No advanced search/filtering on incident history.

## Change Log

- 2026-07-17: **History-aware back navigation (app-wide sweep).** The member shell's hand-rolled
  back chevron was replaced by the shared `BackChevronButton` — it returns to the previous in-app
  page and falls back to All Apps when there is no in-app history. UI-only; no schema, route, or
  contract change.
- 2026-07-14: **Added refresh controls (pilot for the app-wide refresh rollout).** The installed web app (standalone display mode) disables the browser's built-in pull-to-refresh, so a member had no way to re-pull data without closing and reopening the app. ClickLog is the pilot surface for the fix on both platforms: web now shows a shared `RefreshButton` (new `components/shared/refresh-button.tsx` — a spinning `RefreshCw` icon mirroring Chyme's header control) in the mobile and desktop headers, wired to the shell's `fetchIncidents()` reload; the Android screen (`ClickLogScreen`) now has native pull-to-refresh via `RefreshControl` on its `ScrollView`, wired to `load(true)`. The web button defaults to `router.refresh()` when no reload callback is passed, so it is reusable by any shell. Re-introduces a `refreshing` prop/state on the mobile `ClickLogMain` (previously removed as dead in #979) — now actually driving the RefreshControl. UI-only; no schema, route, or contract change. Rollout to the remaining plugins follows after this pilot.
- 2026-07-01: **Removed the dead nav glyphs from the desktop icon rail.** The icon-rail glyphs below the brand mark (a clock, a document) were decorative `<div>`s wired to nothing — ClickLog is a single-view tool, so they had no destination. Styled like buttons but inert, they read as broken/non-clickable. `click-log-icon-rail.tsx` now renders the brand mark plus the shared `PluginRailFooter` only (back to all apps, account and settings, account menu — all real links), matching the same fix shipped for Weekly Performance, Skills Taxonomy, and Unlock. Desktop-only chrome; no schema, route, contract, or mobile change.
- 2026-06-27: **Resolved the click-log code-review sweep findings (#1043–#1049).** The `GET /api/click-log` list route now calls `canViewIncidents(...)` before querying, so the access policy is active and auditable rather than dead code (#1043). `POST /api/click-log` now returns the created incident flat (`NextResponse.json(incident)`) instead of a `{ incident }` wrapper, matching the command contract's `outputSchema`; no current client read the body, so this is a latent-only fix (#1044). The `DELETE /api/click-log/[id]` route now emits a `failure`-result audit event when an authorized delete finds no row (rowCount 0), so every authorized request is audited regardless of storage outcome (#1045). The web shell (`click-log-shell.tsx`) now parses the structured `{ error }` body on a failed POST/DELETE and surfaces the server's specific message instead of a generic string (#1046). Deleted the unused mobile components `ClickLogCounter.tsx` and `ClickLogHistory.tsx`, which `ClickLogScreen` had already subsumed (#1047). Relaxed the `click-log.incident.list` command contract so `userId` is no longer `required` — the list route always derives the user from the authenticated token and never accepts a caller-supplied `userId`, so neither client sends one (#1048). Confirmed the web submit path already wraps form data correctly (`postIncident` wraps its argument in `{ metadata }`), so the #1049 finding was a misread — no change. No schema change.
- 2026-06-26: **Hyphenation rename — `clicklog` → `click-log` (hard cutover, no aliases).** Last of the five plugin folder-name hyphenation renames. Slug, folder, route, command, and contract names all moved from `clicklog` to `click-log`: web `lib/clicklog/` → `lib/click-log/`, `components/clicklog/` → `components/click-log/` (with `clicklog-*` files → `click-log-*`), `app/api/clicklog/` → `app/api/click-log/`, mobile `src/features/clicklog/` → `src/features/click-log/` (with `Clicklog*` files → `ClickLog*`). PascalCase identifiers `Clicklog*` → `ClickLog*` and the command names `clicklog.incident.create`/`.list`/`.delete` → `click-log.incident.*`. The DB table `clicklog_incidents` → `click_log_incidents` and its indexes `idx_clicklog_incidents_*` → `idx_click_log_incidents_*` (snake_case, applied via `ALTER TABLE/INDEX IF EXISTS ... RENAME` guards in `schema.sql` and `schema.demo.sql` so an existing DB keeps its data and a fresh DB builds the new names). The plugin-registry seed row changed from `('clicklog', 'ClickLog', …)` to `('click-log', 'ClickLog', …)` (display name, summary, availability, nav_rank, visibility unchanged) and the old `'clicklog'` row is purged via the consolidated `DELETE … WHERE plugin_slug IN (…)` line. Contract files `CLICKLOG_PLUGIN_*` → `CLICK_LOG_PLUGIN_*`; seed script `seedClicklog.mjs` → `seedClickLog.mjs`; inventory `ctf-clicklog-feature-inventory.md` → `ctf-click-log-feature-inventory.md`. Every web and mobile fetch caller of `/api/clicklog` updated to `/api/click-log`. No env-var name strings or ledger reason-code values changed.
- 2026-06-26: **Resolved the click-log code-review sweep findings (#972–#979).** Added `lib/click-log/audit.ts` and emit an audit event on every allowed `GET`/`POST`/`DELETE` so the audit contract is honoured (#972). `POST /api/click-log` no longer rejects a missing `metadata` — it defaults to `{}` per the command contract (#973) — and trims `notes` before the length check so trailing whitespace can't slip past `MAX_NOTES_LENGTH` or be stored unnormalised (#978). The web shell now sends `x-ctf-csrf: 1` on its POST and DELETE fetches, matching the mobile client (#974). `deleteIncident` takes an `isAdmin` flag and drops the `user_id` condition for admins, so an admin deleting another member's incident no longer returns a spurious 500 (#975). Fixed import ordering in `lib/click-log/repository.ts` (imports now precede `getIncidentById`) (#976). The web shell stores the true DB `count` from the GET response and shows it as the headline total instead of the capped-at-50 array length (#977). Removed the unused `refreshing` prop from the mobile `ClickLogMain` (and the now-unused `refreshing` state) (#979). No schema change.
- 2026-06-23: **Closed an unlock-gating gap (audit finding).** The ClickLog API routes gated only on "is signed in" (`resolveRequestIdentity` + `canCreateIncident`/`canDeleteIncident`), so a signed-in but not-yet-unlocked member could create, read, and delete incidents by calling the API directly — even though the `/apps/click-log` page was gated. This violated the rule that no plugin works while Unlock is pending. Added `app/api/click-log/_lib.ts` `requireClickLogAccess()` over the shared `evaluatePluginAccess()` (default `minUnlockTier: 'approved_full'`, admins pass) and routed `GET`/`POST` (`route.ts`) and `DELETE` (`[id]/route.ts`) through it; the `DELETE` ownership check now reads `userId`/`isAdmin` from the gate decision. Matches every other plugin's `_lib` pattern. No schema change.
- 2026-06-14: Registered ClickLog in the production plugin registry. The plugin was fully built (schema `click_log_incidents`, API routes, web shell + components, mobile feature, contracts, seed) and the dynamic apps route already renders `<ClickLogShell />` for slug `click-log`, but the `ctf_plugin_registry` seed in `schema.sql` was missing the `click-log` row — so production (which reads the DB registry, not the code fallback) never listed or routed to it, leaving the app invisible and the "live plugins" count one short. Added the row (`ClickLog`, `implemented_shell`, nav_rank 180, visible). Run "Update Neon DB" so production gets the row. No code/contract change.

- 2026-06-12: Android API client (`api.ts`) now calls the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs and the empty placeholder token helper. Mutations carry the `x-ctf-csrf: 1` header. No backend, schema, or contract change.
- 2026-05-31: Seed runtime fix. `seedClickLog.mjs` now opens its own `pg` Pool and defines a local `queryDb` helper instead of importing the TypeScript `packages/web/lib/db/postgres.ts`, which plain Node (e.g. the Node 20 seed/provision workflows) cannot load because of its type-only syntax. Added `pool.end()` teardown. No change to seeded rows, schema, or API.
- 2026-05-31: Brought the three contract files into the current per-entry shape so they pass the schema-drift gate's contract validator. The command, access-policy, and audit contracts predated that gate and still used the older single `id:` style; the gate only validates contract files that change in a pull request, so this latent mismatch surfaced when a sibling plugin's contracts were re-validated. Each entry now carries `pluginId: click-log`; the command file's `id:` became `command:` with `version: 1.0.0`; the access-policy file keeps `requiredRoles` with `version: 1.0.0`; and the audit file keeps its existing `eventId` and uses `commandVersion: 1.0.0` (the canonical audit version key from template 203, matching every other plugin's audit contract). No behaviour, schema, route, or API change — documentation/contract shape only.
- 2026-05-29: Web UI circle-back (first design pass; unblocked by the `c5d83c0` design re-pin). Rebuilt `ClickLogShell` to the `ClickLog.tsx` mockup + Empty/Loading states, decomposed into modular sub-components (`click-log-shared`, `click-log-icon-rail`, `click-log-sidebar`, `click-log-right-rail`, `click-log-log-panel`, `click-log-incident-list`, `click-log-empty-state`, `click-log-loading`). All counts derive from real `/api/click-log` data; the modal note form became the mockup's inline form; cleared the prior `any` lint debt; dropped the unused `userId` prop. No schema/API change.
- 2026-05-18: Renamed "Risks & Known Technical Debt" to "Gaps and Known Technical Debt" per Rule 120 canonical heading.
- 2026-04-13: Initial implementation and registration.
