# CTF Bug Reporting — Feature Inventory

## Scope & Boundary

In-app "Report a problem" capture for a non-technical user base. Users never touch
GitHub. A report is stored privately in the app database (the source of truth), then a
separate process redacts it and creates an issue in a **private** triage repo
(`chargingthefuture/bug-reports`). A triage agent investigates and proposes a fix; the
owner approves before any branch or pull request is created. The full decision and the
reasons behind every fail-closed default are recorded in
`.claude/rules/129-bug-reporting-and-triage-rules.mdc`.

This feature owns: the report submission path and storage, the redaction/risk gate, and
the job that publishes redacted reports into the private triage repo. It does **not** own
the eventual code fix (that lands as an ordinary PR on the app repo) or the triage repo's
own contents.

## Intent

Let any signed-in member — including a not-yet-verified one stuck in onboarding — report a
problem in one tap, while keeping anything sensitive or abusive off the public app repo and
keeping a human in the loop before code is written. Built for a single operator scaling
toward millions of users, so the path is automated and the synchronous submit step is fast
and does no external calls.

## User Features

- A "Report a problem" control reached from the global Help control (the "?" item in the
  shell's icon rail on the desktop layout, and the top bar on the phone-width layout). It is
  **not** a plugin grid tile and **not** a standalone page — it opens a modal.
- One short form: what went wrong (required), what you were trying to do (optional). Page and
  plugin are attached automatically; the browser is read server-side. (No app-version constant
  exists in the app yet, so `appVersion` is not sent.)
- Immediate, private storage of the report with a calm confirmation. No technical detail is
  ever asked of the user.

## Admin Features

- A private in-app admin view of reports that were **held for review** (flagged by the redaction
  gate), so an admin can decide on each. **Built (web):** the admin-gated `/admin/bug-reports`
  page (`app/admin/bug-reports/page.tsx` → `components/bug-reports/bug-reports-admin-shell.tsx`)
  lists reports (held first) and releases or rejects each via the admin routes below. Only
  **redacted** text is ever shown — the raw user text never leaves the database (rule 129), so the
  original plan to read raw text in-app was deliberately not built; raw triage stays in the private
  triage repo.

## API Surface and Route Map

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/bug-reports` | any authenticated user | Submit a problem report. Validates and length-caps input, enforces a per-user rate limit, runs the redaction/risk gate, and stores the row. Returns `{ ok, reportId, status }`. |
| GET | `/api/bug-reports/admin` | admin only (`requireBugReportAdminAccess`) | List bug reports for the `/admin/bug-reports` review page, held reports first (`listReportsForAdmin`). Returns `{ ok, items }` with **redacted** message/context only (raw text never leaves the DB, rule 129), plus status, reporter identity (`reporterUsername`, nullable, and `reporterHandle`, always set — admin surface only, never on the triage issue), risk flags/level, page URL, plugin slug, app version, and any triage-repo issue link. |
| POST | `/api/bug-reports/admin/:id/resolve` | admin only, CSRF (`x-ctf-csrf: 1`) | Resolve a held (or new) report. Body `{ action: 'release' \| 'reject' }`: `release` sends it back to `new` so the create-issues job publishes the redacted copy to the triage repo (`releaseHeldReport`); `reject` drops it so it never publishes (`rejectReport`). 409 when the report is not in a resolvable state, 400 on a non-UUID id or an unknown action. Returns `{ ok, id, status }`. |

The admin routes above back the in-app `/admin/bug-reports` review page. No route ever exposes raw (un-redacted) report text — deeper raw triage happens only in the private triage repo (rule 129).

## Data Model and Storage Contracts

Table `bug_reports` (in `ctf/schema.sql`):

- `id` UUID primary key.
- `user_id` TEXT — Clerk user id of the reporter.
- `status` TEXT — one of `new`, `held_for_review`, `issue_created`, `rejected`, `resolved`.
  A clean report is born `new`; a flagged one is born `held_for_review` and never
  auto-advances.
- `raw_message` TEXT, `raw_context` TEXT — the user's words. **Private source of truth;
  never published.**
- `page_url`, `plugin_slug`, `app_version`, `user_agent` TEXT — auto-attached context.
- `redacted_message`, `redacted_context` TEXT — the user's text with emails, phone numbers,
  card-like and token-like strings removed. This is the only text that may leave the app.
- `risk_flags` TEXT[] — which signals tripped (e.g. `pii_email`, `abusive_language`).
- `risk_level` TEXT — `clean`, `flagged`, or `unknown`.
- `triage_repo`, `issue_number`, `issue_url` — set once an issue is created in the private
  triage repo.
- `created_at`, `updated_at` TIMESTAMPTZ.
- Indexes: `idx_bug_reports_status_created_at`, `idx_bug_reports_user_created_at`.

Library modules: `lib/bug-reports/constants.ts`, `lib/bug-reports/sanitize.ts`,
`lib/bug-reports/repository.ts`; route helper `app/api/bug-reports/_lib.ts`.

## Security, Privacy, and Compliance Controls

- **Raw text never leaves the database.** Only redacted text is published, and only into a
  private repo.
- **Fail closed.** Anything the gate flags becomes `held_for_review` and is never
  auto-published; it waits for the owner.
- **Private triage repo.** Issues are created in `chargingthefuture/bug-reports`, not the
  public app repo. (Owner-approved exception to the no-new-repos rule; see rule 129.)
- **Access.** Submission requires any authenticated user (`any_authenticated` unlock tier).
  Mutations require the `x-ctf-csrf` header and a same-origin check.
- **Abuse/flood control.** Per-user rate limit (5 reports / 10 minutes) and length caps.
- **No GitHub credential in the app.** The app only writes to its own database; the
  GitHub token lives only in the CI job that creates issues.

## Web and Android Delivery Status

- **Web (backend):** complete — schema, submit route, redaction/risk gate, repository,
  create-issues job and workflow. The create-issues job
  (`.github/workflows/bug-reports-create-issues.yml` → `ctf/scripts/createBugReportIssues.mjs`)
  runs every 30 minutes, at :11 and :41, so a clean report reaches the triage repo within half an
  hour of being filed and a released held report within half an hour of release — which is what the
  admin screen tells the owner when they press Release. The triage agent
  (`bug-reports-triage.yml`) runs on its own 30-minute schedule at :05 and :35. A report is visible
  on `/admin/bug-reports` the moment it is filed; neither job gates that.
- **Web (UI):** complete — the global Help control + popover (`components/bug-reports/help-control.tsx`,
  wired into `components/community-shell/shell-icon-rail.tsx` on the desktop rail and into the
  phone-width top bar in `community-shell.tsx`) and the report modal
  (`components/bug-reports/bug-report-modal.tsx` with `bug-report-form.tsx`,
  `bug-report-result.tsx`, `bug-report-submit.ts`, and `bug-report-modal.module.css`). The modal
  carries all five states — form, submitting, success, error, rate-limited — using the app's theme
  tokens (no hard-coded gradient).
- **mobile-responsive:** complete — the same web modal renders as a bottom sheet at phone width
  and the Help control sits on the top bar.
- **android:** complete — `packages/mobile/src/features/bug-reporting/` (`BugReportModal.tsx`,
  `ReportAProblemEntry.tsx`, `api.ts`) mirrors the web surface one-to-one with the same five states
  and the same endpoint + CSRF wiring.

The plugin is registered as `bug-reporting` (`implemented_shell`, hidden) — it stays hidden
because it is a Help-menu modal, not a grid tile. Its `ctf/config/plugin-parity-contracts.json`
entry declares `mobileFeatureDirs: ["bug-reporting"]` with `requiresMobileSurface: false`
(the mobile entry is a help/settings row, not a required full plugin surface).

## Seed Coverage Status

No seed script. Reports are user-generated at runtime; there is no fixture data to seed.

## Gaps & Known Technical Debt

- The human-gated build agent (`bug-reports-build.yml`) is built but manual-dispatch only on
  purpose — the owner kicks off each build. The create-issues and triage workflows are both on a
  live 30-minute schedule.
- The admin-landing dot for this area clears only when the admin opens the Bug Reports tile from
  `/admin`. Reaching `/admin/bug-reports` by a direct link or a bookmark does not mark the area
  seen, so the dot stays until the tile is used. This is how every area's dot behaves, not
  something specific to bug reports.
- The build workflow uses the external Claude Code GitHub Action; pin its version and confirm
  its inputs on the first run.
- Redaction is deterministic and conservative; a model-based restatement can be layered on
  later for higher-quality issue text.

## Change Log

- 2026-08-18: **Reports now announce themselves, and reach triage within half an hour (owner
  report).** Five reports had been sitting on `/admin/bug-reports` for days, the oldest from a month
  earlier, and the owner saw all of them for the first time at once — nothing had ever told them a
  report arrived. Three changes, all confirmed against the code:
  1. *The dot never fired.* The admin-landing signal counted only reports still in `new` or
     `held_for_review`. A clean report is `new` for as long as it takes the create-issues job to
     forward it, and the job then flips it to `issue_created` — so the background job was silently
     canceling the dot before anyone saw it, and a report filed while the owner was away never
     showed a dot at all. `lib/admin/area-attention.ts` now counts every report filed since the
     admin last opened the area, whatever the job did with it afterwards; only `rejected` and
     `resolved` (the two states an admin sets by hand) are left out. Registry change only — no
     schema, route, or contract change.
  2. *The forwarding job was slow.* `bug-reports-create-issues.yml` ran every 8 hours, so a report
     could sit in the database most of a day before becoming a triage issue, and the admin screen's
     own Release confirmation promised the next run "within 15 minutes". The job now runs every 30
     minutes (:11 and :41, offset from the triage job at :05 and :35) and the confirmation says 30
     minutes, which is now true.
  3. *The dates were right, the label was not.* Checked end to end: `bug_reports.created_at` is
     `TIMESTAMPTZ`, node-postgres returns it as a real instant, it is serialized as UTC, and the
     admin card renders it in the reader's own time zone. No offset bug. What misled was the layout
     — a bare timestamp sitting next to a green "Sent to triage" pill reads as the day it went to
     triage. The card now says "Filed <date>".

- 2026-08-02: **Deletion burn-down batch 4: bug reports join the deletion registry.** On account deletion, `bug_reports` rows are pseudonymized (`user_id` → `deleted_member`): the report stays for triage (it may already be mirrored into a GitHub issue), the reporter's identity does not.
- 2026-07-18: **"Member view" pill removed from the admin header (owner report: it 404s).** Bug
  reporting has no member page — `/apps/bug-reporting` does not exist; members report through the
  in-app modal — so the pill added in the 2026-07-17 sweep linked to a 404 and is removed. The
  rule-134 admin↔member pairing does not apply to a plugin with no member shell. UI-only; no
  schema, route, or contract change.
- 2026-07-17: **Admin↔member navigation (app-wide sweep).** The admin surface header gained the
  shared "Member view" pill (`PluginUserShellButton`) linking to `/apps/bug-reporting`. UI-only;
  no schema, route, or contract change.
- 2026-07-16: **Form intro copy now scopes the form to problems and points questions to the Commons.** Members were filing general questions through the report form, which is one-way and never sends a reply. The modal's intro line on web (`bug-report-form.tsx`) and android (`BugReportModal.tsx`) — replacing "We read every report." — now states three things in plain words: the form is for something in the app that isn't working; reports are one-way and get no reply; questions belong in the Commons on the home screen, where members can answer. Field labels, placeholders, privacy note, result states, routes, schema, and contracts are unchanged. Test script BUG-1 extended to assert the new copy.
- 2026-07-16: **Reporter identity on the admin review surface.** The admin list (`GET /api/bug-reports/admin` → `listReportsForAdmin`) now returns who filed each report: `reporterUsername` (nullable, from the legacy `public.users` table via a guarded LEFT JOIN — a fresh database without that table degrades to null) and `reporterHandle` (always set — `@username`, or the stable `user-<first 8 of id>` pseudonym from the shared `feedAuthorHandle` helper when no username exists). `bug-reports-admin-shell.tsx` shows a muted "From: <handle>" line next to each card's timestamp (same card on desktop and phone width). Admin surface only: the reporter's identity is never added to the triage-repo issue, so the privacy posture (rule 129) is unchanged. No schema change (`bug_reports.user_id` already existed); no contract change (the plugin has no contract YAMLs). Motivating case: when a "bug report" is actually a member asking for help, the admin needs to know who to follow up with.
- 2026-06-25: **Documented the admin review routes** (inventory-debt burn-down — documentation catch-up, no code change). The admin review surface was already built but the inventory still described it as planned. Added `GET /api/bug-reports/admin` (list reports, held first, redacted-only) and `POST /api/bug-reports/admin/:id/resolve` (release/reject, CSRF + admin) to the API Surface table, and updated Admin Features to record the built `/admin/bug-reports` page. Both verified against the route handlers and the admin page/shell. Removed these two routes from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-12: Android API client (`api.ts`) now calls the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain fetch against an environment-variable base URL with no auth token. The request-timeout guard is kept. No backend, schema, or contract change.
- 2026-06-10: Initial backend foundation — `bug_reports` table, submit route, redaction/risk
  gate, repository, create-issues script and (dispatch-only) workflow, plugin registration
  (hidden), and this inventory. UI deferred pending design.
- 2026-06-11: Web + Android UI built against the approved design. The surface is the global
  Help control (the "?" item in the shell icon rail on desktop, and the phone-width top bar) that
  opens a popover whose one live item, "Report a problem", opens a modal. The modal carries all
  five states — form, submitting, success, error (preserving the typed text), rate-limited — and
  posts to `POST /api/bug-reports` with the `x-ctf-csrf: 1` header and same-origin cookies. It
  attaches `pageUrl` and (on `/apps/<slug>`) `pluginSlug` automatically; `appVersion` is omitted
  because no app-version constant exists yet. Status codes map to states: 201 → success (a
  `held_for_review` status varies one line to say a human will review it), 429 → rate-limited,
  any other non-201 → error. The "Help center" item in the mockup popover/Settings row was
  omitted because no help-center URL exists in the app or config (no dead links). Android mirror
  added at `packages/mobile/src/features/bug-reporting/`. Registry `availabilityState` flipped to
  `implemented_shell` (still `isVisible: false`). Theme tokens replace the mockup's hard-coded
  gradient.
