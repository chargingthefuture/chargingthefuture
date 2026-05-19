# Skills Hunt Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Plugin name: `Skills Hunt`
- Plugin slug / service key: `skills-hunt`
- This document is the living snapshot of Skills Hunt per Rule 120.

## Intent and Outcome

Skills Hunt is a community-sourced skill-discovery and profile-seeding plugin that rewards high-quality submissions and safely generates unclaimed Directory profiles.

This plugin must:

1. run round-based skill discovery campaigns,
2. support contributor submissions with strict validation and anti-spam safeguards,
3. enable moderator/admin review with deterministic scoring,
4. publish individual and team leaderboards,
5. award achievements and user notifications,
6. generate unclaimed Directory profiles from accepted entries,
7. expose a configurable feature reward card,
8. enforce compliance and auditable review decisions.

Planning constraints applied:

1. Inventory/checklist lifecycle follows `.github/instructions/120-plugin-feature-inventory-lifecycle-rules.mdc`.
2. Command/access/audit design follows `.github/instructions/200-plugin-command-contract-templates.mdc` and templates `201`/`202`/`203`.
3. Canonical profile and plugin-extension boundaries follow `.github/instructions/114-single-profile-and-plugin-extension-rules.mdc`.

---

## 1) User Features

### 1.1 Round Discovery and Participation

1. List active, upcoming, and closed Skills Hunt rounds.
2. View round details including scoring config, rules, and dates.
3. Submit entries only during active windows.

### 1.2 Entry Submission Experience

1. Submit `first_name`, `bio`, Quora profile URL, skills, and claimed professions.
2. Enforce URL normalization and Quora profile pattern validation.
3. Prevent duplicate submissions in a round by normalized URL + skills signature.
4. Enforce rolling submission cap per user.

### 1.3 Quality and Safety Validation

1. Reject HTML/script-like payloads in free text fields.
2. Enforce bounded lengths and allowed character sets.
3. Verify profile URL liveness where available.
4. Auto-reject patterns that cross policy thresholds.

### 1.4 Leaderboard and Progress

1. Show individual leaderboard by accepted points.
2. Show team leaderboard by claimed profession aggregates.
3. Surface rank, accepted count, and rare-skill bonus impact.
4. Refresh leaderboard deterministically after review outcomes.

### 1.5 Rewards, Achievements, and Notifications

1. Award achievements for notable contribution milestones.
2. Send in-app notifications for status transitions and awards.
3. Display a configurable feature reward card in plugin surfaces.
4. Let users mark notifications as read.

## 2) Admin and Moderator Features

### 2.1 Round Management

1. Create and update rounds, schedule windows, and scoring config.
2. Set round status (`draft`, `active`, `closed`, `archived`).
3. Track round-level review throughput and acceptance quality.

### 2.2 Submission Review and Moderation

1. Review submissions with actions: accept, reject, edit, flag.
2. Capture review notes and reviewer attribution.
3. Apply scoring breakdown (match, first-match, stack, rare-skill, quality bonus).
4. Enforce rejection-rate guardrails for submitters.

### 2.3 Directory Seeding Governance

1. Generate unclaimed Directory profile projections from accepted submissions.
2. Tag generated records as community-generated with invite attribution.
3. Preserve clear ownership boundary: generated profile is unclaimed until verified owner claims.

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface (Authoritative)

All command contracts conform to:

- `.github/instructions/201-plugin-command-schema-template.mdc`
- `.github/instructions/202-plugin-access-policy-schema-template.mdc`
- `.github/instructions/203-plugin-audit-schema-template.mdc`

Command groups:

1. `skills-hunt.round.create`
2. `skills-hunt.round.update`
3. `skills-hunt.round.list`
4. `skills-hunt.submission.create`
5. `skills-hunt.submission.list`
6. `skills-hunt.submission.review`
7. `skills-hunt.leaderboard.list`
8. `skills-hunt.achievement.list`
9. `skills-hunt.notification.list`
10. `skills-hunt.notification.ack`
11. `skills-hunt.feature-reward-card.get`
12. `skills-hunt.feature-reward-card.update`
13. `skills-hunt.directory-profile.generate`

### 3.2 HTTP Projection Routes

User routes:

- `GET /api/skills-hunt/rounds`
- `POST /api/skills-hunt/rounds/:roundId/submissions`
- `GET /api/skills-hunt/rounds/:roundId/leaderboard?mode=individual|team`
- `GET /api/skills-hunt/achievements`
- `GET /api/skills-hunt/notifications`
- `POST /api/skills-hunt/notifications/:notificationId/read`
- `GET /api/skills-hunt/feature-reward-card`

Admin/moderator routes:

- `POST /api/skills-hunt/admin/rounds`
- `PUT /api/skills-hunt/admin/rounds/:roundId`
- `GET /api/skills-hunt/admin/rounds/:roundId/submissions`
- `POST /api/skills-hunt/admin/submissions/:submissionId/review`
- `PUT /api/skills-hunt/admin/feature-reward-card`
- `POST /api/skills-hunt/admin/submissions/:submissionId/generate-directory-profile`

## 4) Data Model and Storage Contracts

### 4.1 Canonical Identity and Extension Strategy

1. Reuse canonical profile for identity and permission context.
2. Use plugin extension/domain tables for Skills Hunt-specific state.
3. Do not duplicate canonical profile tables.

### 4.2 Domain Entities

1. `skills_hunt_rounds`
2. `skills_hunt_submissions`
3. `skills_hunt_leaderboard`
4. `skills_hunt_achievements`
5. `skills_hunt_notifications`
6. `skills_hunt_feature_reward_card`
7. `skills_hunt_audit_log`
8. `skills_hunt_directory_profiles`
9. `skills_hunt_rare_skills_lookup`

### 4.3 Directory Integration Boundary

1. Skills Hunt may generate unclaimed Directory profile records through governed adapter commands only.
2. Skills Hunt MUST NOT bypass Directory policy controls.
3. Ownership claim lifecycle remains Directory-authoritative.

## 5) Security, Privacy, and Compliance Controls

1. Deny-by-default policy checks on all mutation commands.
2. Role separation for contributor, moderator, and admin operations.
3. Anti-spam/rate-limit controls for submission creation.
4. Audit trails for allow/deny and review decisions.
5. Sensitive-content minimization in logs and notifications.
6. Distinct plugin deletion and full-account deletion behavior.

## 6) Web and Android Delivery Status

`web+android complete`. Round, submission, leaderboard, review, and scoring outcomes are consistent across web (`/apps/skills-hunt`) and Android (`packages/mobile/src/features/skills-hunt`).

## 7) Seed Coverage Status

`ctf/scripts/seedSkillsHuntPhase1.mjs` seeds deterministic rounds, submissions, and moderation fixtures for dev validation.

## 8) Gaps and Known Technical Debt

1. Admin pre-approval submitter pathway is intentionally disabled in the current scope (decision recorded, no UI affordance).
2. URL liveness verification fallback behavior follows a best-effort policy; a stronger SLO contract has not been finalized.
3. Team leaderboard aggregation by profession taxonomy depends on Skills Taxonomy sign-off on grouping semantics.

## 9) Change Log

- 2026-05-18: Renamed "Web and Android Delivery Strategy" to canonical "Web and Android Delivery Status" and confirmed `web+android complete`. Renamed "Gaps, Ambiguities, and Known Debt (Planning)" to canonical "Gaps and Known Technical Debt". Removed Android-parity-deferral entry per Rule 105.
- 2026-02-24: Created initial Skills Hunt CTF rewrite inventory.
