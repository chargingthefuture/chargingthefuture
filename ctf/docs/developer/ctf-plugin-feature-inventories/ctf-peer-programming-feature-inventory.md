# Peer Programming Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Plugin name: `Peer Programming`
- Plugin slug / service key: `peer-programming`
- This document captures planned rewrite scope and contract-aligned behavior.

## Intent and Outcome

Peer Programming in CTF is planned as a persistent, async-first collaboration experience that builds survivor momentum through weekly cohort assignment, guided discussion prompts, and reliable in-app communication.

This plugin must:

1. run weekly cohort assignment from active users (login within the last 7 days),
2. assign exactly 5 users per cohort where capacity allows,
3. push in-app assignment notifications for every assignment cycle,
4. open fallback access when fewer than 2 cohort members show,
5. provide a cohort room optimized for async text with threaded replies,
6. preserve messages and thread context continuously (24/7 persistence),
7. enforce tiered participation across cohort member, authenticated audience, and unauthenticated audience,
8. capture feedback and maintain a closed-loop iteration process,
9. support admin-defined weekly topic guidance.

Web is the first release surface, with Android follow-up parity tracked and closed.

---

## 1) User-Facing Features

### 1.1 Weekly Cohort Assignment

1. Weekly active-user selection includes only accounts with login activity in the prior 7 days.
2. Cohorts are formed with a target size of 5 users per cohort.
3. Assignment status and cohort metadata are visible in the user room entry surface.

### 1.2 In-App Assignment Notifications

1. In-app notifications are generated when users are assigned to a cohort.
2. Notification payload includes cohort identifier, topic window, and next action prompt.
3. Notification delivery failures are retried with idempotent deduplication.

### 1.3 Cohort Room Experience

1. Room header shows weekly topic guidance and cohort participation summary.
2. Message stream is text-first and supports threaded replies per post.
3. Room timeline is 24/7 persistent and recoverable across reconnects.
4. Fallback open mode activates when fewer than 2 cohort members are present/active.

### 1.4 Tiered Participation Visibility

1. Cohort members can create posts and threaded replies.
2. Authenticated non-cohort users can view with audience-limited interaction capabilities.
3. Unauthenticated users are audience-only with constrained read surfaces.

### 1.5 Feedback and Iteration Loop

1. Users can submit structured feedback from cohort room context.
2. Feedback captures release surface, issue type, and suggestion category.
3. Feedback trends inform weekly iteration planning and topic guidance revisions.

## 2) Admin Features

### 2.1 Weekly Topic Guidance Governance

1. Admins define and publish weekly topic guidance.
2. Guidance supports week scoping, revision note, and publication status.
3. Previous guidance revisions remain available for audit and rollback context.

### 2.2 Cohort Operations Oversight

1. Admins can review weekly cohort generation outcomes.
2. Admins can inspect fallback-open activations and root causes.
3. Admin visibility includes delivery health for assignment notifications.

### 2.3 Quality and Iteration Management

1. Admins can review feedback aggregate summaries.
2. Admins can track web-first delivery and Android follow-up parity commitments.
3. Admins can approve iteration candidates for next weekly cycle.

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface (Authoritative)

All command/access/audit contracts must align with:

- `.github/instructions/201-plugin-command-schema-template.mdc`
- `.github/instructions/202-plugin-access-policy-schema-template.mdc`
- `.github/instructions/203-plugin-audit-schema-template.mdc`

Planned command groups:

1. `peer-programming.cohort.weekly.select`
2. `peer-programming.cohort.assignment.notify`
3. `peer-programming.cohort.fallback.open`
4. `peer-programming.room.state.get`
5. `peer-programming.thread.post.create`
6. `peer-programming.thread.reply.create`
7. `peer-programming.thread.list`
8. `peer-programming.participation.tier.resolve`
9. `peer-programming.feedback.submit`
10. `peer-programming.admin.topic-guidance.set`
11. `peer-programming.admin.topic-guidance.get`

### 3.2 HTTP Projection Routes

User routes:

- `GET /api/peer-programming/room/:roomId/state`
- `GET /api/peer-programming/room/:roomId/threads`
- `POST /api/peer-programming/room/:roomId/threads`
- `POST /api/peer-programming/room/:roomId/threads/:threadId/replies`
- `POST /api/peer-programming/room/:roomId/feedback`

System/admin routes:

- `POST /api/peer-programming/system/cohorts/weekly-selection`
- `POST /api/peer-programming/system/cohorts/assignments/notify`
- `POST /api/peer-programming/system/cohorts/:cohortId/fallback-open`
- `PUT /api/peer-programming/admin/topic-guidance/:weekKey`
- `GET /api/peer-programming/admin/topic-guidance/:weekKey`

## 4) Data Model and Storage Contracts

### 4.1 Canonical Identity and Extension Strategy

1. Canonical user profile identity is reused; no duplicate profile table.
2. Plugin extension state is linked by `user_id` and `workspace_id`.
3. Participation tier resolution derives from auth state + cohort membership.

### 4.2 Planned Domain Entities

1. `peer_programming_cohorts`
2. `peer_programming_cohort_memberships`
3. `peer_programming_assignment_notifications`
4. `peer_programming_rooms`
5. `peer_programming_threads`
6. `peer_programming_thread_replies`
7. `peer_programming_topic_guidance`
8. `peer_programming_feedback`
9. `peer_programming_command_idempotency`

### 4.3 Storage and Persistence Constraints

1. Thread posts and replies are append-only and persist continuously (24/7).
2. Weekly assignment snapshots are immutable after publication.
3. Fallback-open transitions capture reason and activation timestamp.
4. Feedback records are retained for iteration analytics and audit.

## 5) Security, Privacy, and Compliance Controls

1. Deny-by-default authorization on all commands.
2. Tier enforcement for cohort member vs authenticated audience vs unauthenticated audience.
3. Workspace tenancy checks on all read and mutation paths.
4. Audit capture for allow/deny policy decisions and mutation results.
5. Data minimization for room rendering and feedback metadata.

## 6) Web-First Delivery and Android Follow-Up

1. MVP launch target is web-first for cohort assignment visibility, room interaction, and feedback.
2. Android follow-up parity is tracked as explicit backlog items with owner and due date.
3. Assignment notification semantics and tier visibility must remain behaviorally consistent across platforms.
4. Any deferred Android capability requires documented risk and closure criteria.

## 8) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

## 9) Gaps, Ambiguities, and Known Debt

1. Final heuristic for partially-filled cohorts when active-user count is not divisible by 5 needs product sign-off.
2. Exact threshold and signal definition for "show" in fallback-open detection needs lock.
3. Notification retry policy and dead-letter workflow need operational RFC.
4. Android parity timeline and owner assignment require release governance lock.

## 10) Change Log

- 2026-02-24: Initial Peer Programming CTF rewrite inventory created with MVP scope, web-first delivery, Android follow-up tracking, tiered participation model, and aligned contract command set.
