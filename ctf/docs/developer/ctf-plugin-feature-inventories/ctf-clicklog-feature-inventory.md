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
- Users can only view/delete their own incidents
- Admins (future) can view/delete all
- See [CLICKLOG_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml](../../contracts/CLICKLOG_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml)

## 8. Web and Android Delivery Status

- Web: Implemented shell, full parity, pixel-aligned to `ClickLog.tsx` mockup
- Android: Implemented shell, full parity, pixel-aligned to `MobileClickLog.tsx` mockup (2026-05-31)
- See [plugin-parity-contracts.json](../../../config/plugin-parity-contracts.json)

Web pixel pass (design `c5d83c0`): `ClicklogShell` is rebuilt to `design/.../survivor-hub/ClickLog.tsx`
and its Empty/Loading states. The plain shell was replaced with the mockup's dark (`#0F1117` / brand
`#E91E8C`) layout — icon rail, sidebar (total + this-week strip + encryption note), the large circular
"Log Incident" button with an inline note form, the recent-incidents list, and the right-rail stats +
safety reminder — decomposed into modular sub-components within the rule-116 limits. All counters
(total, this-week weekday strip, this-week/this-month/with-notes/with-location stats) are derived from
the real `/api/clicklog` data; none are dummy. The note form posts to `/api/clicklog` (optional
geolocation via the browser), delete calls `DELETE /api/clicklog/:id`. ClickLog is a private, auth-only
tool, so there is no public state on web (the `ClickLogPublic.tsx` mockup is not implemented by
design on web).

Android pixel pass (2026-05-31): `ClicklogScreen` (`ctf/packages/mobile/src/features/clicklog/ClicklogScreen.tsx`)
is rebuilt to `design/.../survivor-hub/MobileClickLog.tsx` + `MobileClickLogEmpty.tsx`,
`MobileClickLogLoading.tsx`, and `MobileClickLogPublic.tsx`. All four screen states are covered. RN
primitives replace web DOM/Lucide with Ionicons + StyleSheet. Design tokens exact:
`BG=#0F1117`, `BRAND=#E91E8C`, `SURFACE=#161B27`, `BORDER=#1E2A3A`. Real data bindings:
- `incidents[]` and `count` from `GET /api/clicklog` (real response shape)
- Today/this-week badge counts computed client-side from `incidents[].created_at`
- Log button calls `POST /api/clicklog` with optional geolocation + notes
- Delete calls `DELETE /api/clicklog/[id]` with confirm dialog
- 401 response → transitions to public (unauthenticated) state
Omissions (no backing API field): bottom-nav "Export" button rendered per mockup but no-ops (no
export API exists).

## 9. Seed Coverage Status

- See [scripts/seedClicklog.mjs](../../../scripts/seedClicklog.mjs)
- 3–5 sample incidents with varied metadata

## 10. Gaps and Known Technical Debt

- No admin UI for global view/delete; admin access is via direct DB tooling.
- No rate limiting on incident creation beyond shared platform defaults.
- No advanced search/filtering on incident history.

## Change Log

- 2026-05-31: Android pixel pass. Rewrote `ClicklogScreen.tsx` to `MobileClickLog.tsx` mockup (all
  four states: loading, public, empty, main). Updated `ClicklogTabs.tsx` to delegate to
  `ClicklogScreen`. Real bindings: `incidents[]`/`count` from `GET /api/clicklog`; today/week counts
  computed from `created_at`; POST/DELETE wired to real endpoints. "Export" nav tab omitted (no API).
  typecheck: only pre-existing expo/tsconfig.base constraint. EOF: clean. Parity check: passes.
- 2026-05-29: Web UI circle-back (first design pass; unblocked by the `c5d83c0` design re-pin). Rebuilt `ClicklogShell` to the `ClickLog.tsx` mockup + Empty/Loading states, decomposed into modular sub-components (`clicklog-shared`, `clicklog-icon-rail`, `clicklog-sidebar`, `clicklog-right-rail`, `clicklog-log-panel`, `clicklog-incident-list`, `clicklog-empty-state`, `clicklog-loading`). All counts derive from real `/api/clicklog` data; the modal note form became the mockup's inline form; cleared the prior `any` lint debt; dropped the unused `userId` prop. No schema/API change.
- 2026-05-18: Renamed "Risks & Known Technical Debt" to "Gaps and Known Technical Debt" per Rule 120 canonical heading.
- 2026-04-13: Initial implementation and registration.
