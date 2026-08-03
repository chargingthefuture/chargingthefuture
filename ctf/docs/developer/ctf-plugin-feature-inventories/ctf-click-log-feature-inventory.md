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
- Optionally tag an incident with which known problem happened ("Which problem happened?" — the
  50+ problems list published on the public landing page) and/or which named scheme was used
  ("Which scheme was used?" — schemes named in the owner's now-deprecated "A post for each gang
  stalker game" Discourse thread plus schemes described in the owner's archived posts;
  `lib/click-log/tags.ts` is the living canonical list). One, both, or neither tag may be picked.
  Both pickers are type-and-search filtered chip pickers (mimicking the Directory / SkillsHunt
  skill pickers). A tagged incident requires a location — the form disables Submit (with an
  explanation) until location is added, and the server enforces the same rule — because tagged
  trend data needs location to be detailed enough. Tags show as chips on the history rows and
  feed trend reporting.
- Suggest a new scheme via the "Not listed" scheme tag (Weavers of the Commons badge holders
  only — members without the badge do not see the option). Picking it requires a written
  description of the scheme (up to 200 characters) that is explicitly shared with the owner —
  the field says so; incident notes stay never-shared — plus an optional link to the member's
  own Quora post about a similar incident (an https quora.com link, also shared; it helps the
  owner tell real reports from spam). This intake is how new schemes earn a name: suggestions
  flow to the owner's private triage queue, and a real one becomes a pull request adding the
  scheme to the canonical list.
- View incident count and history
- Delete own incidents
- Choose whether an incident is shared with the owner for trend tracking: a global "share new
  incidents by default" setting plus a per-incident override (in the log form and on each history
  row). Sharing is opt-in and off until the member turns it on, and can be turned off again per
  incident at any time. Shared incidents contribute only coarse trend data (day, approximate area,
  count) — never the note or exact location.

## 4. Admin Features

- ClickLog Trends dashboard (`/admin/click-log`): aggregate counts over incidents members opted to
  share — shared total, days with activity, per-day counts, area-cluster count (each area is a
  ~11 km cell), and "Top problems" / "Top schemes" tag breakdowns (per-tag counts over the
  canonical tag slugs). No notes, precise coordinates, incident ids, or member identity are visible.
- Scheme-naming pipeline (scheduled, outside the app): `.github/workflows/clicklog-scheme-suggestions.yml`
  runs `ctf/scripts/proposeSchemeSuggestions.mjs` twice a day. It (a) drains new "Not listed"
  suggestions into one issue per distinct text in the private triage repo
  (`chargingthefuture/bug-reports`) — carrying the suggestion text, the optional Quora self-link,
  a same-text count, and dates, never member identity or incident ids — and (b) files a single
  threshold alert (counts only) when shared "Not listed" incidents reach 5 in 90 days, at most one
  alert per 30 days (`click_log_unnamed_scheme_alerts` is the dedupe marker). The pipeline never
  edits the canonical scheme list; naming a scheme stays a PR to `lib/click-log/tags.ts` plus the
  landing-page `/schemes` mirror.
- View all incidents (future)
- Delete any incident (future)

## 5. API Surface and Route Map

- `GET /api/click-log` — List incidents for authenticated user. Returns `{ incidents, count, canSuggestScheme }` (`canSuggestScheme` = whether this member holds the Weavers of the Commons badge and so may pick "Not listed"). The user is always derived from the authenticated token (no caller-supplied `userId`); the access policy (`canViewIncidents`) is applied before the query.
- `POST /api/click-log` — Create incident. Accepts optional `sharedWithOwner` boolean (falls back to the member's stored global default) and optional `problemTag` / `schemeTag` strings (each validated against the canonical slug lists in `lib/click-log/tags.ts`; an unknown slug is a 400). When either or both tags are present, `metadata.latitude`/`metadata.longitude` are required (400 otherwise). When `schemeTag` is `other-scheme` ("Not listed"): `schemeSuggestion` is required (1–200 chars after trim), `schemeQuoraUrl` is optional (must be an https quora.com link), the caller must hold the Weavers badge (403 otherwise), and the suggestion is stored in `click_log_scheme_suggestions`; suggestion fields with any other `schemeTag` are a 400. Returns the created incident flat (a `ClickLogIncident`, not wrapped under `{ incident }`), matching the command contract's `outputSchema`.
- `DELETE /api/click-log/[id]` — Delete incident by id. Returns `{ success: true }`.
- `PATCH /api/click-log/[id]` — Toggle owner-sharing on a single incident. Body `{ sharedWithOwner }`; only the incident's owner may call it (no admin override — consent is the member's alone). Returns `{ success, sharedWithOwner }`.
- `GET /api/click-log/preferences` — Read the member's global owner-share default (`{ shareWithOwner }`).
- `PUT /api/click-log/preferences` — Set the member's global owner-share default. Body `{ shareWithOwner }`.
- `GET /api/click-log/admin/trends` — Admin-only aggregate trends over shared incidents from the last 90 days: `{ buckets, tagTrends }` — `buckets` of day / ~11 km location cell / count, plus `tagTrends` of tag kind (`problem` | `scheme`) / tag slug / count.

## 6. Data Model and Storage Contracts

- Table: `click_log_incidents`
  - `id UUID PRIMARY KEY`
  - `user_id TEXT`
  - `metadata JSONB NOT NULL DEFAULT '{}'` (latitude, longitude, notes)
  - `shared_with_owner BOOLEAN NOT NULL DEFAULT FALSE` — member's per-incident owner-share opt-in; a real column (not metadata) so it is excluded from the `metadata_hash` dedupe
  - `problem_tag TEXT` (nullable) — optional coarse tag: which of the 50+ known problems happened; slug validated against `lib/click-log/tags.ts` (mirrors the landing-page problems list). Real column, excluded from the `metadata_hash` dedupe.
  - `scheme_tag TEXT` (nullable) — optional coarse tag: which named scheme was used; slug validated against `lib/click-log/tags.ts` (schemes started from the owner's "A post for each gang stalker game" Discourse thread, now deprecated — `tags.ts` is the living canonical list and grows there; slugs are never renamed or reused so trend history stays comparable). Real column, excluded from the `metadata_hash` dedupe.
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Indexes: `user_id`, `created_at DESC`, partial `created_at DESC WHERE shared_with_owner` (for the trends aggregate)
- Table: `click_log_preferences`
  - `user_id TEXT PRIMARY KEY`
  - `share_with_owner BOOLEAN NOT NULL DEFAULT FALSE` — global default applied to newly logged incidents when the request carries no explicit choice
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Upsert-on-`user_id`; a missing row reads as the opt-in default (not shared)
- Table: `click_log_scheme_suggestions` — "Not listed" scheme descriptions, explicitly shared with the owner
  - `id UUID PRIMARY KEY`
  - `incident_id UUID` (nullable; the incident it was written with — no FK, matching the incidents table's conventions)
  - `user_id TEXT NOT NULL` (for moderation and account deletion only; never surfaced in issues)
  - `suggestion TEXT NOT NULL` (1–200 chars, validated in the create route)
  - `quora_url TEXT` (nullable; validated https quora.com self-link)
  - `status TEXT NOT NULL DEFAULT 'new'` (`new` → `issue_created`), `triage_repo TEXT`, `issue_number INTEGER`, `issue_url TEXT` — pipeline tracking, mirroring `bug_reports`
  - `created_at` / `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Index: `(status, created_at)` for the pipeline drain
  - Deletion registry: `delete` on account deletion (an already-filed triage issue persists, like a bug report; the database row and member link are removed)
- Table: `click_log_unnamed_scheme_alerts` — dedupe marker for the threshold alert; counts only, no member data
  - `id UUID PRIMARY KEY`, `window_days INTEGER NOT NULL`, `shared_count INTEGER NOT NULL`, `issue_url TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

## 7. Security, Privacy, and Compliance Controls

- Auth required for all actions
- Users can only view/delete their own incidents; admins can view/delete any incident
- The "Not listed" scheme-suggestion text is the one deliberate exception to "tags carry no free
  text": it is a separate field explicitly labeled as shared with the owner (submission is the
  consent act), stored apart from `metadata.notes` (which keeps its absolute never-shared
  guarantee), capped at 200 chars, Weavers-of-the-Commons-gated (client hides the option;
  server returns 403), and drained only into the PRIVATE triage repo — issues never carry
  member identity or incident ids. Suggestion fields sent with any other scheme tag are rejected.
- Incident tags are coarse by construction: values come only from the fixed canonical slug lists
  in `lib/click-log/tags.ts` (the create route rejects unknown slugs), so tag data can never carry
  free text. A tagged incident must carry a location (client and server enforced) so tagged trend
  data is detailed enough; the location itself still only ever reaches the owner as the rounded
  ~11 km cell, and only for incidents the member opted to share. The trends aggregate over tags
  (`getSharedIncidentTagTrends`) reads only `shared_with_owner = true` rows and projects only tag
  slug + count.
- Owner sharing is strictly opt-in and member-controlled: both the global default and every
  per-incident flag default to off; only the incident's owner may toggle its share state
  (`canToggleIncidentShare` — deliberately no admin override); and the trends aggregate reads only
  `shared_with_owner = true` rows. The privacy boundary is enforced in SQL
  (`getSharedIncidentTrends` projects only day / 1-decimal (~11 km) location cell / count — notes,
  precise coordinates, incident ids, and member identity never leave the query).
- The trends endpoint and `/admin/click-log` page are admin-gated (`requireClickLogAdminAccess`,
  `canViewSharedTrends`, server-side `isAdmin` redirect).
- Mutating routes enforce CSRF server-side (`ensureMutationCsrf`: the `x-ctf-csrf: 1` header plus a
  same-origin check, matching the sibling plugins); the web client sends the header on every mutation.
- Every authorized operation emits an audit event (`click-log.incident.create`/`.list`/`.delete`,
  `click-log.incident.share.set`, `click-log.preferences.fetch`/`.update`, `click-log.trends.fetch`)
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
- Tag coverage: one incident tagged with both a problem and a scheme, one problem-only, one
  scheme-only, and untagged incidents; every tagged seed incident carries a location, matching
  the tags-require-location rule
- One "Not listed" incident plus a matching `click_log_scheme_suggestions` row (status `new`,
  with a Quora self-link) so a demo run of the suggestion pipeline has something to drain

## 10. Gaps and Known Technical Debt

- No admin UI for global view/delete; admin access is via direct DB tooling.
- No rate limiting on incident creation beyond shared platform defaults.
- No advanced search/filtering on incident history.

## Change Log

- 2026-08-03: **"Not listed" scheme-suggestion intake + naming pipeline (owner request).** The
  catch-all scheme tag's label changed "Other / not named yet" → "Not listed" (slug `other-scheme`
  frozen; the landing `/schemes` mirror is renamed in a companion landing-page PR). Picking it now
  REQUIRES a description of the scheme (1–200 chars) that is explicitly shared with the owner —
  the field says so, and it is stored in the new `click_log_scheme_suggestions` table, never in
  `metadata.notes` (which stays never-shared) — plus an optional https quora.com self-link (spam
  signal). The option is limited to Weavers of the Commons badge holders (owner decision, spam
  control): `GET /api/click-log` now returns `canSuggestScheme` (badge check via
  `contributor_access_eligibility`), the client hides the option for non-holders, and the create
  route independently returns 403. New scheduled pipeline
  (`.github/workflows/clicklog-scheme-suggestions.yml` → `ctf/scripts/proposeSchemeSuggestions.mjs`,
  twice daily, mirroring the skills-promotion and bug-report pipelines): drains `status='new'`
  suggestions into one PRIVATE triage-repo issue per distinct text (suggestion + Quora link +
  same-text count + dates; never member identity or incident ids), and files a threshold alert
  (counts only) when shared "Not listed" incidents reach 5 in 90 days, at most one alert per 30
  days (`click_log_unnamed_scheme_alerts`). The pipeline never edits the canonical list — naming a
  scheme stays a PR to `tags.ts` + the landing mirror. Deletion registry: suggestions are deleted
  with the account (filed issues persist, like bug reports). Contracts: `incident.create` → 1.3.0,
  `incident.list` → 1.1.0, access policy create → 1.1.0 with the Weavers conditional and the
  shared-suggestion consent note. Seed gains a "Not listed" incident + suggestion row. Android:
  out of scope (web-only per rule 105).
- 2026-08-02: **Optional incident tags: problem + scheme (owner request).** A member can now tag a
  logged incident with which of the 50+ known problems happened and/or which named scheme was used
  — one, both, or neither; both optional. A tagged incident requires a location (client disables
  Submit until location is added; the server returns 400 on a tagged request without
  latitude/longitude) — owner decision: tagged trend data needs location to be detailed enough.
  Canonical slug lists live in `lib/click-log/tags.ts`: problem tags mirror the 50+ problems list
  on the public landing page (`chargingthefuture/landing-page` `LOOK_MA_ITEMS`, 51 entries);
  scheme tags started from the owner's "A post for each gang stalker game" Discourse thread (The
  Scapegoating by Proxy, The Mail Mirage, The Conspiracy Carousel, The "That's a nice ____") plus
  recurring schemes described in the owner's archived posts (Honey Pot, Entrapment / Bait, Staged
  "Needing Help", Good Cop Bad Cop, Fake Counselor / Fake Help, Lure to a Location, Staged
  Narratives / Loud "Podcasts") and an "Other / not named yet" catch-all. Discourse is deprecated
  (owner decision, 2026-08-02): its posts stay valid but will not gain new schemes or refined
  definitions, so `tags.ts` is the living canonical scheme list; slugs are never renamed or
  reused. Both tag pickers are type-and-search filtered chip pickers
  (`click-log-tag-picker.tsx`), mimicking the Directory / SkillsHunt skill pickers (search box
  with clear control, "✓" chips, removable selected chip) but single-select. Storage: new
  nullable `problem_tag` / `scheme_tag` columns on
  `click_log_incidents` (real columns, excluded from the `metadata_hash` dedupe, mirroring
  `shared_with_owner`); `schema.demo.sql` regenerated via `generateDemoSchema.mjs` (this also
  caught the demo file up with earlier schema.sql changes it had missed). API:
  `POST /api/click-log` accepts optional `problemTag`/`schemeTag`, validated against the canonical
  lists (unknown slug → 400); `GET /api/click-log/admin/trends` adds `tagTrends` (tag kind + slug
  + count over shared rows only — the privacy boundary stays in SQL). Web shell: two optional
  dropdowns in the log form ("Which problem happened?" / "Which scheme was used?"), tag chips on
  history rows; admin trends dashboard adds "Top problems" / "Top schemes" sections. Contracts:
  `click-log.incident.create` → 1.2.0, `click-log.trends.fetch` → 1.1.0, `ClickLogIncident` gains
  `problem_tag`/`scheme_tag`, new `SharedIncidentTagTrend` definition. Seed gains tagged rows.
  Android: out of scope (web-only per rule 105).
- 2026-08-01: **Owner-share opt-in + admin trends (owner request).** ClickLog stays private by
  default; a member can now opt in to sharing incidents with the owner for trend tracking. Added
  `shared_with_owner` to `click_log_incidents` (real column, excluded from the `metadata_hash`
  dedupe) and the `click_log_preferences` table (global default, upsert-on-user_id, defaults off).
  New routes: `PATCH /api/click-log/[id]` (per-incident share toggle, owner-only — no admin
  override), `GET/PUT /api/click-log/preferences`, and admin-only `GET /api/click-log/admin/trends`
  whose SQL aggregate returns only coarse buckets (UTC day, location rounded to 1 decimal ≈ 11 km,
  count) — notes, precise coordinates, incident ids, and member identity never leave the query. Web
  shell gains the global-default checkbox, a share checkbox in the log form, and a per-row
  Shared/Private toggle; new `/admin/click-log` trends dashboard (registered in `ADMIN_AREAS`).
  Added `requireClickLogAdminAccess` and server-side CSRF enforcement (`ensureMutationCsrf`) on all
  mutating ClickLog routes. Contracts updated (create command → 1.1.0 with optional
  `sharedWithOwner`; new share.set / preferences / trends commands with access policies and audit
  events). Android: out of scope (web-only per rule 105).
- 2026-07-17: **History-aware back navigation (app-wide sweep).** The member shell's hand-rolled
  back chevron was replaced by the shared `BackChevronButton` — it returns to the previous in-app
  page and falls back to All Apps when there is no in-app history. UI-only; no schema, route, or
  contract change.
- 2026-07-14: **Added refresh controls (pilot for the app-wide refresh rollout).** The installed web app (standalone display mode) disables the browser's built-in pull-to-refresh, so a member had no way to re-pull data without closing and reopening the app. ClickLog is the pilot surface for the fix on both platforms: web now shows a shared `RefreshButton` (new `components/shared/refresh-button.tsx` — a spinning `RefreshCw` icon mirroring Chyme's header control) in the mobile and desktop headers, wired to the shell's `fetchIncidents()` reload; the Android screen (`ClickLogScreen`) now has native pull-to-refresh via `RefreshControl` on its `ScrollView`, wired to `load(true)`. The web button defaults to `router.refresh()` when no reload callback is passed, so it is reusable by any shell. Re-introduces a `refreshing` prop/state on the mobile `ClickLogMain` (previously removed as dead in #979) — now actually driving the RefreshControl. UI-only; no schema, route, or contract change. Rollout to the remaining plugins follows after this pilot.
- 2026-07-01: **Removed the dead nav glyphs from the desktop icon rail.** The icon-rail glyphs below the brand mark (a clock, a document) were decorative `<div>`s wired to nothing — ClickLog is a single-view tool, so they had no destination. Styled like buttons but inert, they read as broken/non-clickable. `click-log-icon-rail.tsx` now renders the brand mark plus the shared `PluginRailFooter` only (back to all apps, account and settings, account menu — all real links), matching the same fix shipped for Weekly Performance, Skills Taxonomy, and Unlock. Desktop-only chrome; no schema, route, contract, or mobile change.
- 2026-06-27: **Resolved the click-log code-review sweep findings (#1043–#1049).** The `GET /api/click-log` list route now calls `canViewIncidents(...)` before querying, so the access policy is active and auditable rather than dead code (#1043). `POST /api/click-log` now returns the created incident flat (`NextResponse.json(incident)`) instead of a `{ incident }` wrapper, matching the command contract's `outputSchema`; no current client read the body, so this is a latent-only fix (#1044). The `DELETE /api/click-log/[id]` route now emits a `failure`-result audit event when an authorized delete finds no row (rowCount 0), so every authorized request is audited regardless of storage outcome (#1045). The web shell (`click-log-shell.tsx`) now parses the structured `{ error }` body on a failed POST/DELETE and surfaces the server's specific message instead of a generic string (#1046). Deleted the unused mobile components `ClickLogCounter.tsx` and `ClickLogHistory.tsx`, which `ClickLogScreen` had already subsumed (#1047). Relaxed the `click-log.incident.list` command contract so `userId` is no longer `required` — the list route always derives the user from the authenticated token and never accepts a caller-supplied `userId`, so neither client sends one (#1048). Confirmed the web submit path already wraps form data correctly (`postIncident` wraps its argument in `{ metadata }`), so the #1049 finding was a misread — no change. No schema change.
- 2026-06-26: **Hyphenation rename — `clicklog` → `click-log` (hard cutover, no aliases).** Last of the five plugin folder-name hyphenation renames. Slug, folder, route, command, and contract names all moved from `clicklog` to `click-log`: web `lib/clicklog/` → `lib/click-log/`, `components/clicklog/` → `components/click-log/` (with `clicklog-*` files → `click-log-*`), `app/api/clicklog/` → `app/api/click-log/`, mobile `src/features/clicklog/` → `src/features/click-log/` (with `Clicklog*` files → `ClickLog*`). PascalCase identifiers `Clicklog*` → `ClickLog*` and the command names `clicklog.incident.create`/`.list`/`.delete` → `click-log.incident.*`. The DB table `clicklog_incidents` → `click_log_incidents` and its indexes `idx_clicklog_incidents_*` → `idx_click_log_incidents_*` (snake_case, applied via `ALTER TABLE/INDEX IF EXISTS ... RENAME` guards in `schema.sql` and `schema.demo.sql` so an existing DB keeps its data and a fresh DB builds the new names). The plugin-registry seed row changed from `('clicklog', 'ClickLog', …)` to `('click-log', 'ClickLog', …)` (display name, summary, availability, nav_rank, visibility unchanged) and the old `'clicklog'` row is purged via the consolidated `DELETE … WHERE plugin_slug IN (…)` line. Contract files `CLICKLOG_PLUGIN_*` → `CLICK_LOG_PLUGIN_*`; seed script `seedClicklog.mjs` → `seedClickLog.mjs`; inventory `ctf-clicklog-feature-inventory.md` → `ctf-click-log-feature-inventory.md`. Every web and mobile fetch caller of `/api/clicklog` updated to `/api/click-log`. No env-var name strings or ledger reason-code values changed.
- 2026-06-26: **Resolved the click-log code-review sweep findings (#972–#979).** Added `lib/click-log/audit.ts` and emit an audit event on every allowed `GET`/`POST`/`DELETE` so the audit contract is honoured (#972). `POST /api/click-log` no longer rejects a missing `metadata` — it defaults to `{}` per the command contract (#973) — and trims `notes` before the length check so trailing whitespace can't slip past `MAX_NOTES_LENGTH` or be stored unnormalized (#978). The web shell now sends `x-ctf-csrf: 1` on its POST and DELETE fetches, matching the mobile client (#974). `deleteIncident` takes an `isAdmin` flag and drops the `user_id` condition for admins, so an admin deleting another member's incident no longer returns a spurious 500 (#975). Fixed import ordering in `lib/click-log/repository.ts` (imports now precede `getIncidentById`) (#976). The web shell stores the true DB `count` from the GET response and shows it as the headline total instead of the capped-at-50 array length (#977). Removed the unused `refreshing` prop from the mobile `ClickLogMain` (and the now-unused `refreshing` state) (#979). No schema change.
- 2026-06-23: **Closed an unlock-gating gap (audit finding).** The ClickLog API routes gated only on "is signed in" (`resolveRequestIdentity` + `canCreateIncident`/`canDeleteIncident`), so a signed-in but not-yet-unlocked member could create, read, and delete incidents by calling the API directly — even though the `/apps/click-log` page was gated. This violated the rule that no plugin works while Unlock is pending. Added `app/api/click-log/_lib.ts` `requireClickLogAccess()` over the shared `evaluatePluginAccess()` (default `minUnlockTier: 'approved_full'`, admins pass) and routed `GET`/`POST` (`route.ts`) and `DELETE` (`[id]/route.ts`) through it; the `DELETE` ownership check now reads `userId`/`isAdmin` from the gate decision. Matches every other plugin's `_lib` pattern. No schema change.
- 2026-06-14: Registered ClickLog in the production plugin registry. The plugin was fully built (schema `click_log_incidents`, API routes, web shell + components, mobile feature, contracts, seed) and the dynamic apps route already renders `<ClickLogShell />` for slug `click-log`, but the `ctf_plugin_registry` seed in `schema.sql` was missing the `click-log` row — so production (which reads the DB registry, not the code fallback) never listed or routed to it, leaving the app invisible and the "live plugins" count one short. Added the row (`ClickLog`, `implemented_shell`, nav_rank 180, visible). Run "Update Neon DB" so production gets the row. No code/contract change.

- 2026-06-12: Android API client (`api.ts`) now calls the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs and the empty placeholder token helper. Mutations carry the `x-ctf-csrf: 1` header. No backend, schema, or contract change.
- 2026-05-31: Seed runtime fix. `seedClickLog.mjs` now opens its own `pg` Pool and defines a local `queryDb` helper instead of importing the TypeScript `packages/web/lib/db/postgres.ts`, which plain Node (e.g. the Node 20 seed/provision workflows) cannot load because of its type-only syntax. Added `pool.end()` teardown. No change to seeded rows, schema, or API.
- 2026-05-31: Brought the three contract files into the current per-entry shape so they pass the schema-drift gate's contract validator. The command, access-policy, and audit contracts predated that gate and still used the older single `id:` style; the gate only validates contract files that change in a pull request, so this latent mismatch surfaced when a sibling plugin's contracts were re-validated. Each entry now carries `pluginId: click-log`; the command file's `id:` became `command:` with `version: 1.0.0`; the access-policy file keeps `requiredRoles` with `version: 1.0.0`; and the audit file keeps its existing `eventId` and uses `commandVersion: 1.0.0` (the canonical audit version key from template 203, matching every other plugin's audit contract). No behavior, schema, route, or API change — documentation/contract shape only.
- 2026-05-29: Web UI circle-back (first design pass; unblocked by the `c5d83c0` design re-pin). Rebuilt `ClickLogShell` to the `ClickLog.tsx` mockup + Empty/Loading states, decomposed into modular sub-components (`click-log-shared`, `click-log-icon-rail`, `click-log-sidebar`, `click-log-right-rail`, `click-log-log-panel`, `click-log-incident-list`, `click-log-empty-state`, `click-log-loading`). All counts derive from real `/api/click-log` data; the modal note form became the mockup's inline form; cleared the prior `any` lint debt; dropped the unused `userId` prop. No schema/API change.
- 2026-05-18: Renamed "Risks & Known Technical Debt" to "Gaps and Known Technical Debt" per Rule 120 canonical heading.
- 2026-04-13: Initial implementation and registration.
