# CTF Bug Reporting — Feature Inventory

## Scope & Boundary

In-app "Report a problem" capture for a non-technical user base. Users never touch
GitHub. A report is stored privately in the app database (the source of truth), then a
separate process redacts it and creates an issue in a **private** triage repo
(`chargingthefuture/bug-reports`). A triage agent investigates and proposes a fix; the
owner approves before any branch or pull request is created. The full decision and the
reasons behind every fail-closed default are recorded in
`.github/instructions/129-bug-reporting-and-triage-rules.mdc`.

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

## Target User Features

- A "Report a problem" control reached from the global Help control (the "?" item in the
  shell's icon rail on the desktop layout, and the top bar on the phone-width layout). It is
  **not** a plugin grid tile and **not** a standalone page — it opens a modal.
- One short form: what went wrong (required), what you were trying to do (optional). Page and
  plugin are attached automatically; the browser is read server-side. (No app-version constant
  exists in the app yet, so `appVersion` is not sent.)
- Immediate, private storage of the report with a calm confirmation. No technical detail is
  ever asked of the user.

## Target Admin Features

- A private in-app view of reports that were **held for review** (flagged by the redaction
  gate) so the owner can read the raw text in a private place and decide. (Planned; not in
  this pass.)

## API Surface and Route Map

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/bug-reports` | any authenticated user | Submit a problem report. Validates and length-caps input, enforces a per-user rate limit, runs the redaction/risk gate, and stores the row. Returns `{ ok, reportId, status }`. |

Admin/triage read routes are planned and not part of this pass.

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
  create-issues job and workflow.
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

- The private admin view for held reports is not built.
- The triage agent (`bug-reports-triage.yml`) and the human-gated build agent
  (`bug-reports-build.yml`) are built but manual-dispatch only until the triage repo's labels
  exist, `GH_PAT` can read+write it, and `ANTHROPIC_API_KEY` / `DATABASE_URL` are available.
- The build workflow uses the external Claude Code GitHub Action; pin its version and confirm
  its inputs on the first run.
- Redaction is deterministic and conservative; a model-based restatement can be layered on
  later for higher-quality issue text.

## Change Log

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
