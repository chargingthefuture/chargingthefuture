# ClickLog Plugin Feature Inventory

## 1. Scope & Boundary

ClickLog provides a simple, auditable incident counter and logging system for users, supporting optional location and notes metadata. It is designed for event tracking, user journaling, and lightweight incident reporting.

## 2. Intent & Outcome

- Allow users to log incidents with a single tap/click
- Optionally capture geolocation and notes
- Display a running count and history
- Support deletion and auditability

## 3. Target User Features

- Log incident (with optional location/notes)
- View incident count and history
- Delete own incidents
- Mobile and web parity

## 4. Target Admin Features

- View all incidents (future)
- Delete any incident (future)

## 5. API Surface and Route Map

- `GET /api/clicklog` — List incidents for authenticated user
- `POST /api/clicklog` — Create incident
- `DELETE /api/clicklog/[id]` — Delete incident by id

## 6. Data Model and Storage Contracts

- Table: `clicklog_incidents`
  - `id UUID PRIMARY KEY`
  - `user_id TEXT`
  - `metadata JSONB NOT NULL DEFAULT '{}'` (latitude, longitude, notes)
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Indexes: `user_id`, `created_at DESC`

## 7. Security, Privacy, and Compliance Controls

- Auth required for all actions
- Users can only view/delete their own incidents; admins can view/delete any incident
- Web and mobile mutations send the `x-ctf-csrf: 1` header
- Every allowed operation emits an audit event (`clicklog.incident.create`/`.list`/`.delete`)
  via `lib/clicklog/audit.ts`, matching [CLICKLOG_PLUGIN_AUDIT_CONTRACTS.yaml](../../contracts/CLICKLOG_PLUGIN_AUDIT_CONTRACTS.yaml)
- See [CLICKLOG_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml](../../contracts/CLICKLOG_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml)

## 8. Web and Android Delivery Status

- Web: Implemented shell, full parity
- Android: Implemented shell, full parity
- See [plugin-parity-contracts.json](../../../config/plugin-parity-contracts.json)

Web pixel pass (design `c5d83c0`): `ClicklogShell` is rebuilt to `design/.../survivor-hub/ClickLog.tsx`
and its Empty/Loading states. The plain shell was replaced with the mockup's dark (`#0F1117` / brand
`#E91E8C`) layout — icon rail, sidebar (total + this-week strip + encryption note), the large circular
"Log Incident" button with an inline note form, the recent-incidents list, and the right-rail stats +
safety reminder — decomposed into modular sub-components within the rule-116 limits. All counters
(total, this-week weekday strip, this-week/this-month/with-notes/with-location stats) are derived from
the real `/api/clicklog` data; none are dummy. The note form posts to `/api/clicklog` (optional
geolocation via the browser), delete calls `DELETE /api/clicklog/:id`. ClickLog is a private, auth-only
tool, so there is no public state (the `ClickLogPublic.tsx` mockup is not implemented by design). The
Android pixel pass to `MobileClickLog.tsx` remains tracked in `PRODUCTION_READINESS_PLAN.md`.

## 9. Seed Coverage Status

- See [scripts/seedClicklog.mjs](../../../scripts/seedClicklog.mjs)
- 3–5 sample incidents with varied metadata

## 10. Gaps and Known Technical Debt

- No admin UI for global view/delete; admin access is via direct DB tooling.
- No rate limiting on incident creation beyond shared platform defaults.
- No advanced search/filtering on incident history.

## Change Log

- 2026-06-26: **Resolved the clicklog code-review sweep findings (#972–#979).** Added `lib/clicklog/audit.ts` and emit an audit event on every allowed `GET`/`POST`/`DELETE` so the audit contract is honoured (#972). `POST /api/clicklog` no longer rejects a missing `metadata` — it defaults to `{}` per the command contract (#973) — and trims `notes` before the length check so trailing whitespace can't slip past `MAX_NOTES_LENGTH` or be stored unnormalised (#978). The web shell now sends `x-ctf-csrf: 1` on its POST and DELETE fetches, matching the mobile client (#974). `deleteIncident` takes an `isAdmin` flag and drops the `user_id` condition for admins, so an admin deleting another member's incident no longer returns a spurious 500 (#975). Fixed import ordering in `lib/clicklog/repository.ts` (imports now precede `getIncidentById`) (#976). The web shell stores the true DB `count` from the GET response and shows it as the headline total instead of the capped-at-50 array length (#977). Removed the unused `refreshing` prop from the mobile `ClicklogMain` (and the now-unused `refreshing` state) (#979). No schema change.
- 2026-06-23: **Closed an unlock-gating gap (audit finding).** The ClickLog API routes gated only on "is signed in" (`resolveRequestIdentity` + `canCreateIncident`/`canDeleteIncident`), so a signed-in but not-yet-unlocked member could create, read, and delete incidents by calling the API directly — even though the `/apps/clicklog` page was gated. This violated the rule that no plugin works while Unlock is pending. Added `app/api/clicklog/_lib.ts` `requireClicklogAccess()` over the shared `evaluatePluginAccess()` (default `minUnlockTier: 'approved_full'`, admins pass) and routed `GET`/`POST` (`route.ts`) and `DELETE` (`[id]/route.ts`) through it; the `DELETE` ownership check now reads `userId`/`isAdmin` from the gate decision. Matches every other plugin's `_lib` pattern. No schema change.
- 2026-06-14: Registered ClickLog in the production plugin registry. The plugin was fully built (schema `clicklog_incidents`, API routes, web shell + components, mobile feature, contracts, seed) and the dynamic apps route already renders `<ClicklogShell />` for slug `clicklog`, but the `ctf_plugin_registry` seed in `schema.sql` was missing the `clicklog` row — so production (which reads the DB registry, not the code fallback) never listed or routed to it, leaving the app invisible and the "live plugins" count one short. Added the row (`ClickLog`, `implemented_shell`, nav_rank 180, visible). Run "Update Neon DB" so production gets the row. No code/contract change.

- 2026-06-12: Android API client (`api.ts`) now calls the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs and the empty placeholder token helper. Mutations carry the `x-ctf-csrf: 1` header. No backend, schema, or contract change.
- 2026-05-31: Seed runtime fix. `seedClicklog.mjs` now opens its own `pg` Pool and defines a local `queryDb` helper instead of importing the TypeScript `packages/web/lib/db/postgres.ts`, which plain Node (e.g. the Node 20 seed/provision workflows) cannot load because of its type-only syntax. Added `pool.end()` teardown. No change to seeded rows, schema, or API.
- 2026-05-31: Brought the three contract files into the current per-entry shape so they pass the schema-drift gate's contract validator. The command, access-policy, and audit contracts predated that gate and still used the older single `id:` style; the gate only validates contract files that change in a pull request, so this latent mismatch surfaced when a sibling plugin's contracts were re-validated. Each entry now carries `pluginId: clicklog`; the command file's `id:` became `command:` with `version: 1.0.0`; the access-policy file keeps `requiredRoles` with `version: 1.0.0`; and the audit file keeps its existing `eventId` and uses `commandVersion: 1.0.0` (the canonical audit version key from template 203, matching every other plugin's audit contract). No behaviour, schema, route, or API change — documentation/contract shape only.
- 2026-05-29: Web UI circle-back (first design pass; unblocked by the `c5d83c0` design re-pin). Rebuilt `ClicklogShell` to the `ClickLog.tsx` mockup + Empty/Loading states, decomposed into modular sub-components (`clicklog-shared`, `clicklog-icon-rail`, `clicklog-sidebar`, `clicklog-right-rail`, `clicklog-log-panel`, `clicklog-incident-list`, `clicklog-empty-state`, `clicklog-loading`). All counts derive from real `/api/clicklog` data; the modal note form became the mockup's inline form; cleared the prior `any` lint debt; dropped the unused `userId` prop. No schema/API change.
- 2026-05-18: Renamed "Risks & Known Technical Debt" to "Gaps and Known Technical Debt" per Rule 120 canonical heading.
- 2026-04-13: Initial implementation and registration.
