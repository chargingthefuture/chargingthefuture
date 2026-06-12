# Peer Programming Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Plugin name: `Peer Programming`
- Plugin slug / service key: `peer-programming`
- Owned surfaces: `/apps/peer-programming` (web), `packages/mobile/src/features/peer-programming` (Android), `/api/peer-programming/*` routes, `peer_programming_*` tables.
- Not owned: identity (Clerk), chat infrastructure (Chyme/Hub), notifications transport (shared notifications plugin).

## Intent and Outcome

Peer Programming is a persistent, async-first collaboration experience that builds survivor momentum through weekly cohort assignment, guided discussion prompts, and reliable in-app communication.

The plugin:

1. Runs weekly cohort assignment from active users (login within the last 7 days),
2. Assigns up to 5 users per cohort,
3. Records in-app assignment notifications for every assignment cycle with idempotent delivery,
4. Opens fallback access when fewer than 2 cohort members are present,
5. Provides a cohort room optimized for async text with threaded replies,
6. Preserves messages and thread context continuously (24/7 persistence),
7. Enforces tiered participation across cohort member, authenticated audience, and unauthenticated audience,
8. Captures structured feedback for iteration,
9. Supports admin-defined weekly topic guidance.

---

## Target User Features

### Weekly Cohort Assignment

1. Weekly active-user selection includes only accounts with login activity in the prior 7 days.
2. Cohorts are formed with a target size of 5 users per cohort.
3. Assignment status and cohort metadata are visible in the user room entry surface.

### In-App Assignment Notifications

1. In-app notifications are generated when users are assigned to a cohort.
2. Notification payload includes cohort identifier, topic window, and next action prompt.
3. Notification delivery is idempotent on `idempotency_key`.

### Cohort Room Experience

1. Room header shows weekly topic guidance and cohort participation summary.
2. Message stream is text-first and supports threaded replies per message.
3. Room timeline persists continuously and is recoverable across reconnects.
4. Fallback open mode activates when fewer than 2 cohort members are present/active.

### Tiered Participation Visibility

1. Cohort members can create posts and threaded replies.
2. Authenticated non-cohort users can view with audience-limited interaction capabilities.
3. Unauthenticated users are audience-only with constrained read surfaces.

### Feedback and Iteration Loop

1. Users can submit structured feedback from cohort room context.
2. Feedback captures release surface, issue type, and suggestion category.
3. Feedback records are retained for iteration analytics and audit.

## Target Admin Features

### Weekly Topic Guidance Governance

1. Admins define and publish weekly topic guidance.
2. Guidance supports week scoping, revision note, and publication status.
3. Previous guidance revisions remain available for audit and rollback context.

### Cohort Operations Oversight

1. Admins can run the weekly cohort assignment process on demand.
2. Admins can inspect fallback-open activations on cohorts.
3. Admin visibility includes delivery health for assignment notifications.

## API Surface and Route Map

### User Routes

- `GET /api/peer-programming/room` — Resolve the caller's current cohort, topic guidance, and tier.
- `POST /api/peer-programming/messages` — Create a new top-level message in the caller's cohort.
- `POST /api/peer-programming/messages/[messageId]/replies` — Reply to a message thread.
- `POST /api/peer-programming/feedback` — Submit structured feedback for the iteration loop.

### Admin Routes

- `GET /api/peer-programming/admin/topics` — Return the topic published for the current week (the room reads the current week only), or null.
- `PUT /api/peer-programming/admin/topics` — Upsert weekly topic guidance for a week key (requires `weekStartDate`, `title`, `guidance`; optional `revisionNote`, `publish`).
- `POST /api/peer-programming/admin/assignments/run` — Run the weekly cohort assignment process. With no override it selects the last-7-days active set; an optional `{ allowManualOverride, activeUserIds }` body runs against an explicit user-id list.

These admin routes are now surfaced by a real admin UI on both web and Android (see Web and Android Delivery Status). The web admin page (`/admin/peer-programming`) and the Android admin screen are admin-gated and bind only the three routes above.

## Data Model and Storage Contracts

### Canonical Identity and Extension Strategy

1. Canonical user profile identity is reused; no duplicate profile table.
2. Plugin extension state is linked by `user_id` (Clerk subject) and cohort id.
3. Participation tier resolution derives from auth state + cohort membership.

### Tables Owned by This Plugin

1. `peer_programming_weekly_topics` — Weekly topic guidance (id, week_start_date, title, guidance, revision_note, status, created_by_user_id, published_by_user_id, published_at).
2. `peer_programming_cohorts` — Weekly cohorts (id, week_start_date, cohort_label, fallback_open, topic_id, assigned_by_user_id).
3. `peer_programming_cohort_members` — Cohort membership (id, cohort_id, user_id).
4. `peer_programming_messages` — Cohort messages with threaded replies (id, cohort_id, author_user_id, parent_message_id, body, tier).
5. `peer_programming_feedback` — Structured feedback (id, cohort_id, user_id, issue_type, suggestion_category, release_surface, note).
6. `peer_programming_assignment_notifications` — Notification ledger (id, cohort_id, user_id, idempotency_key, payload, delivered_at).

### Storage and Persistence Constraints

1. Messages and replies are append-only and persist continuously.
2. Weekly cohort and membership rows are immutable after assignment completes.
3. Fallback-open transitions are recorded by toggling `fallback_open` on the cohort row.
4. Feedback records are retained for iteration analytics and audit.

## Security, Privacy, and Compliance Controls

1. Deny-by-default authorization on all commands via `requirePeerProgrammingReadAccess` / `requirePeerProgrammingAdminAccess`.
2. Tier enforcement for cohort member vs authenticated audience vs unauthenticated audience.
3. CSRF confirmation header required on all mutations (`x-ctf-csrf: 1`) plus origin match.
4. Audit capture for allow/deny policy decisions and mutation results.
5. Data minimization for room rendering and feedback metadata.

## Web and Android Delivery Status

`web+android complete` (pixel-pass delivered). The web surface lives under `/apps/peer-programming` and the Android surface lives under `packages/mobile/src/features/peer-programming`.

**Admin surface (2026-06-06):** the admin page at `/admin/peer-programming` is now a real, mobile-responsive admin UI — it replaced the former plain-text stub. The web admin shell (`components/peer-programming/pp-admin-shell.tsx` + `pp-admin-topic-form.tsx` + `pp-admin-assignments.tsx` + `pp-admin-shared.ts`) is consistent with the other `/admin/{plugin}` screens (generic admin aesthetic; matches the whatworks / skills-hunt admin layout, filter/action conventions, and CSRF mutation helper). It uses `hooks/use-is-mobile.ts` so it is usable on a phone. Two actions are wired, both backed by existing endpoints: (1) set/publish the weekly topic via `PUT /api/peer-programming/admin/topics` (with the current published topic loaded via `GET`), and (2) run the weekly cohort assignment via `POST /api/peer-programming/admin/assignments/run` (with an optional manual user-id override). The Android admin screen lives at `packages/mobile/src/features/peer-programming/AdminPeerProgramming.tsx` (+ `admin-api.ts`), is registered in `App.tsx`, binds the same three endpoints, and is admin-gated server-side (a non-admin sees an access notice). No new admin actions or commands were invented — only the existing endpoints are surfaced.

Contract note: the command contract file (`docs/contracts/PEER_PROGRAMMING_PLUGIN_COMMAND_CONTRACTS.yaml`) defines `admin.topic-guidance.set` / `admin.topic-guidance.get` (topics) and `cohort.weekly.select` (assignment run); the admin UI surfaces exactly these and adds no new commands. The audit command strings the routes emit (`peer-programming.topic.upsert`, `peer-programming.cohort.weekly.select`) differ in spelling from the contract command names — a pre-existing naming nuance, not introduced by this UI work, and worth reconciling in a later contract/audit pass. Web pixel pass complete: the shell (`peer-programming-shell.tsx` + `pp-*` sub-components) is aligned to `design/.../survivor-hub/PeerProgramming.tsx` (lucide icons, encrypted-session copy) within rule-116 limits; binds real `/api/peer-programming/room` + `/messages` + `/feedback`. Android pixel pass complete (2026-05-31): `PeerProgramming.tsx` rewritten to match `design/.../survivor-hub/MobilePeerProgramming.tsx` with real-data-only binding via `GET /api/peer-programming/room`; mock data retired (`MockPeerProgramming.tsx` is no longer imported); decomposed into `pp-loading.tsx`, `pp-public.tsx`, `pp-empty.tsx`, `pp-cohort-tab.tsx`, `pp-session-tab.tsx` subcomponents within rule-116 limits. Fabricated cohort list / global stats omitted per real-data-only rule. `api.ts` updated to call real backend routes with Clerk auth token.

## Seed Coverage Status

Deterministic Peer Programming seed script: `ctf/scripts/seedPeerProgramming.mjs` (topics, cohorts, members, messages, feedback, notifications).

## Gaps and Known Technical Debt

1. Heuristic for partially-filled cohorts when active-user count is not divisible by 5 is implemented as best-effort packing; product sign-off on edge cases is pending.
2. Definition of "show" for fallback-open detection currently relies on cohort membership presence; a stronger activity signal is a known follow-up.

## Change Log

- 2026-06-12: The Android Peer Programming API clients (`api.ts`, `admin-api.ts`) now use the shared authenticated fetch helper, which attaches the signed-in user's Clerk bearer token and reads the server address from runtime config (`APP_URL`), replacing plain fetch calls against hardcoded development URLs; the hand-passed token parameter (which the screens filled with the user id, not a real token) was removed from every function and call site. No schema, route, or contract change.
- 2026-06-06: Admin UI reconciliation. Replaced the plain-text `/admin/peer-programming` stub with a real, mobile-responsive admin surface: new web components `pp-admin-shell.tsx`, `pp-admin-topic-form.tsx`, `pp-admin-assignments.tsx`, `pp-admin-shared.ts` (under `components/peer-programming/`), aligned to the existing `/admin/{plugin}` aesthetic (whatworks / skills-hunt) and within rule-116 file-size limits; uses `hooks/use-is-mobile.ts` for phone usability. Wired two actions, both backed by existing endpoints only: set/publish the weekly topic (`GET`/`PUT /api/peer-programming/admin/topics`) and run weekly cohort assignment (`POST /api/peer-programming/admin/assignments/run`, with an optional manual user-id override). Added the Android admin screen `AdminPeerProgramming.tsx` + `admin-api.ts`, registered in `App.tsx`, binding the same three endpoints and admin-gated server-side (non-admin sees an access notice). Page admin gate unchanged from the stub (`evaluatePluginAccess({ requireApprovedUserOrAdmin: true })` then redirect when not `isAdmin`). No new commands invented; noted the pre-existing audit-vs-contract command-name spelling nuance for a later reconciliation. Web typecheck + eslint clean; mobile tsc (TypeScript 5.9.3) + eslint clean; no `key` on a class-based RN host component; EOF format check passes.
- 2026-05-31: Android pixel pass — rewrote `PeerProgramming.tsx` to match `design/.../survivor-hub/MobilePeerProgramming.tsx`. Updated `api.ts` to call real `GET /api/peer-programming/room` endpoint (replaces fabricated `fetchCohorts` stub). Retired `MockPeerProgramming.tsx` import. Decomposed into `pp-loading.tsx`, `pp-public.tsx`, `pp-empty.tsx`, `pp-cohort-tab.tsx`, `pp-session-tab.tsx` within rule-116 limits. Color/spacing/type/nav match design canonical (#8B5CF6, dark background, bottom nav bar). Omitted design's fabricated cohort list and global stats (no real backing field); real data binding via cohort room endpoint only. TypeScript clean, EOF format clean, parity check passes.
- 2026-05-31: Seed runtime fix. `seedPeerProgramming.mjs` now opens its own `pg` Pool and defines a local `queryDb` helper instead of importing the TypeScript `packages/web/lib/db/postgres.ts`, which plain Node (e.g. the Node 20 seed/provision workflows) cannot load. Added `pool.end()` teardown. No change to seeded rows, schema, or API.
- 2026-05-30: Web pixel pass — aligned the shell to `design/.../survivor-hub/PeerProgramming.tsx` and decomposed the 366-line / complexity-46 monolith into modular sub-components (`pp-shared.ts`, `pp-loading.tsx`, `pp-icon-rail`, `pp-sidebar`, `pp-cohorts-tab`, `pp-session-tab`, `pp-chat-tab`, `pp-right-panel`, thin shell; extracted a `fetchRoomData` helper) within rule-116 limits. Swapped emoji icons for the design's lucide icons, aligned "Video session via GetStream" to the design's "Video session — encrypted", and dropped the fabricated "Forming: 2" sidebar badge. Dropped the unused `userId`/`isAdmin` props at the call site. No schema/route/contract changes.
- 2026-05-18: Inventory rewritten to enforce Rule 120 living-snapshot model. Removed "Web-First Delivery and Android Follow-Up" section and all web-first / Android-follow-up parity language; confirmed `web+android complete`. Replaced "planned" command groups and "Planned Domain Entities" with the actual shipped routes and tables. Synced table names with `ctf/schema.sql` and route list with `ctf/packages/web/app/api/peer-programming/`.
- 2026-02-24: Initial Peer Programming CTF rewrite inventory created.


## Build Checklist

> **Reconciliation (2026-05-26):** the Delivery Status above is `web+android complete` (feature parity).
> Unchecked items below are obsolete web-first / Android-deferral planning artifacts and deferred MVP
> validation/release gates (Rule 118) — not missing implementation. The authoritative production bar
> (pixel-perfect to `design` + parity + gates + deploy) is tracked in
> `ctf/docs/developer/PRODUCTION_READINESS_PLAN.md`, which wins where it differs from this checklist.

### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [ ] Confirm plugin slug and command namespace lock.
  - Acceptance criteria:
    - Stable plugin slug is `peer-programming` across docs/contracts/routes.
- [ ] Confirm MVP functional scope lock.
  - Acceptance criteria:
    - Weekly active-user selection (login within 7 days), 5-user cohorts, assignment notifications, fallback-open behavior, room UI, threaded async text, tiered participation, feedback loop, and admin topic guidance are all explicitly accepted.

### �� Contract Lock

- [ ] Define plugin command contracts for v1.
  - Acceptance criteria:
    - Every command conforms to `.github/instructions/201-plugin-command-schema-template.mdc`.
- [ ] Define plugin access policy contracts for v1.
  - Acceptance criteria:
    - Every command has aligned role, attribute, consent/lawful basis, region, and deny conditions under `.github/instructions/202-plugin-access-policy-schema-template.mdc`.
- [ ] Define plugin audit contracts for v1.
  - Acceptance criteria:
    - Every command has allow/deny + result audit coverage under `.github/instructions/203-plugin-audit-schema-template.mdc`.
- [ ] Verify command parity across all three contract files.
  - Acceptance criteria:
    - Command set matches exactly across command, policy, and audit YAML.

### �� Cohort Selection and Assignment

- [ ] Implement weekly active-user selection based on login recency.
  - Acceptance criteria:
    - Selection includes only users with login activity in the prior 7 days.
- [ ] Implement cohort formation rules.
  - Acceptance criteria:
    - Target cohort size is 5 users per cohort.
    - Partial cohort handling is deterministic and documented.
- [ ] Implement assignment notification flow.
  - Acceptance criteria:
    - In-app notification event is generated for each assigned member.
    - Notification retries are idempotent.

### �� Room Experience and Persistence

- [ ] Implement cohort room state retrieval.
  - Acceptance criteria:
    - Room state includes active topic guidance, member summary, and fallback-open status.
- [ ] Implement async text-first thread posting.
  - Acceptance criteria:
    - Cohort members can create root posts.
- [ ] Implement threaded reply flow.
  - Acceptance criteria:
    - Replies are scoped to parent thread and ordered deterministically.
- [ ] Implement 24/7 persistence behavior.
  - Acceptance criteria:
    - Posts/replies remain available across reconnects and session restarts.

### �� Fallback and Tiered Participation

- [ ] Implement fallback-open activation path.
  - Acceptance criteria:
    - Fallback-open mode activates when fewer than 2 cohort members show.
- [ ] Implement participation tier resolver.
  - Acceptance criteria:
    - Access behavior is enforced across cohort member, authenticated audience, and unauthenticated audience tiers.
- [ ] Validate tier-based action restrictions.
  - Acceptance criteria:
    - Non-cohort and unauthenticated users are blocked from unauthorized write actions.

### �� Topic Guidance and Feedback Loop

- [ ] Implement admin weekly topic guidance set/get.
  - Acceptance criteria:
    - Topic guidance is scoped by week and available to room surfaces.
- [ ] Implement in-room feedback submit flow.
  - Acceptance criteria:
    - Feedback captures issue category and suggestion payload.
- [ ] Close iteration loop with review cadence.
  - Acceptance criteria:
    - Feedback summaries are reviewed weekly and linked to follow-up planning decisions.

### �� Web-First Delivery and Android Follow-Up

- [ ] Deliver MVP web-first release for all core commands.
  - Acceptance criteria:
    - Weekly selection, assignment notifications, room state, posting, replies, tier resolution, fallback-open, feedback, and topic guidance all function on web.
- [ ] Create Android follow-up parity tracker.
  - Acceptance criteria:
    - Each deferred Android item has owner, target date, risk, and closure criteria.
- [ ] Verify cross-platform semantic parity for completed capabilities.
  - Acceptance criteria:
    - Completed Android items match web command outcomes and deny reason behavior.

### �� Security, Audit, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Policy deny-by-default posture design.
  - Acceptance criteria:
    - All commands document expected deny conditions for missing role/scope/tenancy or tier mismatch.
- [ ] Audit integrity design.
  - Acceptance criteria:
    - Allow and deny outcomes are documented with request/trace correlation requirements for each command.
- [ ] Contract and integration design documentation. [MANUAL TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Command schema and policy/audit behavior requirements are documented.
- [ ] Inventory and checklist synchronization.
  - Acceptance criteria:
    - Feature inventory + checklist are updated in same PR as scope or contract changes.

### Open Decisions Tracker

- [ ] Final fallback-open "show" detection signals (presence heartbeat vs message activity).
- [ ] Strategy for users left unassigned in low-activity weeks.
- [ ] Final Android parity deadline and release owner.

### Change Log

- 2026-02-24: Initial Peer Programming rewrite checklist created with MVP feature gates, web-first release path, and Android follow-up parity tracking requirements.
