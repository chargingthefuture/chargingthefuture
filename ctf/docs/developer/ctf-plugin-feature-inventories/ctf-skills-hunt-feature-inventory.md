# Skills Hunt Plugin Feature Inventory (CTF Rewrite)

> **For new agents:** read `ctf-skills-hunt-session-continuity.md` BEFORE this file. That document is the canonical source of truth for spec, locked owner decisions, audit findings, and the implementation roadmap. This inventory tracks what is currently planned/implemented in the codebase.

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Plugin name: `Skills Hunt`
- Plugin slug / service key: `skills-hunt`
- This document is the planning inventory required before implementation.
- Active rewrite branch: `claude/audit-skills-hunt-plugin-6yv3e` (Wave 1 + Wave 2 per session-continuity §6).

## Intent and Outcome

Skills Hunt is planned as a community-sourced skill-discovery and profile-seeding plugin that rewards high-quality submissions and safely generates unclaimed Directory profiles.

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

## 1) Planned User Features

### 1.1 Round Discovery and Participation

1. List active, upcoming, and closed Skills Hunt rounds.
2. View round details including scoring config, rules, and dates.
3. Submit entries only during active windows.

### 1.2 Entry Submission Experience

1. Submit display name (2–100 chars, alphanumeric + spaces), bio (max 280 chars), Quora profile URL, taxonomy-selected skills, optional proposed (free-text) skills, and claimed professions.
2. Enforce URL normalization and Quora profile pattern validation.
3. Liveness HEAD-check on URL with 5s timeout; persist `url_validation_result` ∈ {valid, invalid, dead}.
4. Prevent duplicate submissions in a round by normalized URL + skills signature.
5. Enforce rolling submission cap per user with reputation-driven dynamic limits (see §5).
6. Submitter must have a confirmed `@handle` (Clerk-managed); `requireUsername: true` on submit endpoint.

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

## 2) Planned Admin and Moderator Features

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

## 3) API Surface and Route Map (Planned)

### 3.1 Plugin Command Surface (Authoritative)

All command contracts conform to:

- `.github/instructions/201-plugin-command-schema-template.mdc`
- `.github/instructions/202-plugin-access-policy-schema-template.mdc`
- `.github/instructions/203-plugin-audit-schema-template.mdc`

Planned command groups:

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

### 3.2 HTTP Projection Routes (Planned)

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

## 4) Data Model and Storage Contracts (Planned)

### 4.1 Canonical Identity and Extension Strategy

1. Reuse canonical profile for identity and permission context.
2. Use plugin extension/domain tables for Skills Hunt-specific state.
3. Do not duplicate canonical profile tables.

### 4.2 Planned Domain Entities

1. `skills_hunt_rounds` — round lifecycle, configurable scoring weights.
2. `skills_hunt_submissions` — contributor submissions; tracks `url_validation_result`, `credit_granted`, `proposed_skills`, `edit_history`, `edited_at`, `deleted_at`, `participation_points`.
3. `skills_hunt_leaderboard` — per-round standings; includes `first_match_count` for tie-break and `pending_points`/`last_submission_at` for UI.
4. `skills_hunt_achievements` — 5 named badges (First Finder, Diversity Champion, Rare Talent Scout, Quality Contributor, Leaderboard Champion) plus `round_id` and `archived_at`.
5. `skills_hunt_notifications` — in-DB notification ledger. Polled by client at 30s via `GET /api/skills-hunt/notifications`. GetStream is explicitly out of scope (see continuity doc §2.11).
6. `skills_hunt_feature_reward_card` — singleton row for the Directory-pinned reward card.
7. `skills_hunt_audit_log` — append-only allow/deny + mutation log.
8. `skills_hunt_directory_profiles` — junction between accepted submission and generated unclaimed Directory profile.
9. `skills_hunt_rare_skills_lookup` — per-round rarity snapshot computed from Workforce plugin (<50% recruited).
10. `skills_hunt_submission_reports` — community moderation reports against community-generated Directory profiles.
11. `skills_hunt_service_credits_transactions` — service-credit reward ledger.

### 4.3 Directory Integration Boundary

1. Skills Hunt may generate unclaimed Directory profile records through governed adapter commands only (`generateDirectoryProfileFromAcceptedSubmission`).
2. Skills Hunt MUST NOT bypass Directory policy controls.
3. Ownership claim lifecycle remains Directory-authoritative.
4. Generated profiles are stamped `directory_profiles.source = 'community-generated'`, `invited_by_username` is set from the submitter's `@handle`, and a `unclaimed_handle` is auto-generated in the reserved `community-<hex>` namespace.
5. Backfill (one-shot): every existing unclaimed Directory profile receives a `community-<6char-hex>` handle so the `@handle` URL story is consistent on day one.

## 5) Security, Privacy, and Compliance Controls (Planned)

1. Deny-by-default policy checks on all mutation commands.
2. Role separation for contributor, moderator, and admin operations.
3. Anti-spam controls: rolling 7-day submission cap, reputation-driven dynamic limits (new users start lower; >20% rejection rate requires admin pre-approval; ≥80% acceptance rate raises cap).
4. Audit trails for allow/deny and review decisions in `skills_hunt_audit_log`.
5. Sensitive-content minimization in logs and notifications.
6. Distinct plugin deletion and full-account deletion behavior; soft-delete columns (`deleted_at`) on all user-scoped tables; `DELETE /api/account/skills-hunt-profile` is GDPR-compliant erasure path.
7. Community moderation: report flow against community-generated Directory profiles (`skills_hunt_submission_reports`) with admin escalation queue.
8. Clerk reserved-prefix enforcement: usernames starting with `community-` are rejected at signup; defense-in-depth check at API layer in `lib/auth/username-policy.ts`.

## 6) Web and Android Delivery Strategy (Planned)

1. Web-first initial delivery for round, submission, and leaderboard flows.
2. Android parity follows via checklist-tracked milestones.
3. Review semantics and scoring outcomes must remain cross-platform consistent.

## 7) Seed Coverage Status (Planned)

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

## 8) Gaps, Ambiguities, and Known Debt (Planning)

Tracked in detail in `ctf-skills-hunt-session-continuity.md` §3.2 and §7. Summary as of 2026-05-11 audit:

1. Admin preapproval submitter pathway: re-enable as part of reputation system (Wave 2).
2. URL liveness HEAD-check: implemented in Wave 1; persist `url_validation_result`.
3. Team leaderboard aggregation: keyed by claimed profession taxonomy; one team per profession; aggregated `score` and `accepted_count`.
4. Android parity: mobile feature currently a hardcoded mock — rebuild planned in Wave 2.
5. Leaderboard live updates: starting with 30-second polling; WebSocket upgrade deferred pending engagement metrics.

## 9) Change Log

- 2026-02-24: Created initial Skills Hunt CTF rewrite inventory with round lifecycle, validated submissions, moderation scoring, leaderboards, achievements, notifications, feature reward card, and Directory unclaimed-profile generation scope.
- 2026-05-11: Aligned inventory with locked owner decisions (taxonomy-first skills field, Clerk-managed `@handle` + reserved `community-` prefix, live Workforce rare-skill snapshot, Directory-public reward-card placement); enumerated all domain entities including new `_submission_reports` and `_service_credits_transactions`; documented Directory backfill plan; cross-referenced `ctf-skills-hunt-session-continuity.md` as canonical source of truth.
