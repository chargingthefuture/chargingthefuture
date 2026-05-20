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

- `GET /api/peer-programming/admin/topics` — List weekly topic guidance revisions.
- `PUT /api/peer-programming/admin/topics` — Upsert weekly topic guidance for a week key.
- `POST /api/peer-programming/admin/assignments/run` — Run the weekly cohort assignment process.

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

`web+android complete`. The web surface lives under `/apps/peer-programming` and the Android surface lives under `packages/mobile/src/features/peer-programming`. Notification, tier, and room behaviors are behaviorally consistent across platforms.

## Seed Coverage Status

The plugin does not yet have a dedicated `seedPeerProgrammingPhase0.mjs` script; cohort, topic, message, and feedback rows are exercised through admin assignment runs and runtime fixtures in development.

## Gaps and Known Technical Debt

1. Heuristic for partially-filled cohorts when active-user count is not divisible by 5 is implemented as best-effort packing; product sign-off on edge cases is pending.
2. Definition of "show" for fallback-open detection currently relies on cohort membership presence; a stronger activity signal is a known follow-up.

## Change Log

- 2026-05-18: Inventory rewritten to enforce Rule 120 living-snapshot model. Removed "Web-First Delivery and Android Follow-Up" section and all web-first / Android-follow-up parity language; confirmed `web+android complete`. Replaced "planned" command groups and "Planned Domain Entities" with the actual shipped routes and tables. Synced table names with `ctf/schema.sql` and route list with `ctf/packages/web/app/api/peer-programming/`.
- 2026-02-24: Initial Peer Programming CTF rewrite inventory created.
