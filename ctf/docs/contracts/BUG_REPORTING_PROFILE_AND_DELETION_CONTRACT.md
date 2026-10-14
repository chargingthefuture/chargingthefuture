# Bug Reporting Profile and Deletion Contract

Written from the code as it stands on 2026-10-04 (docs only; no behavior changed). The deletion
behavior below is what `ctf/packages/web/lib/account/deletion-registry.ts` (entry `bug-reports`)
and `ctf/packages/web/lib/account/deletion-engine.ts` do; the export behavior is what
`ctf/packages/web/lib/account/export-engine.ts` does with the same entry. Where this file and the
code ever differ, the code is right and this file is out of date.

## 1) Plugin Metadata

- Plugin Name: Bug Reporting (the "Report a problem" form, reached from the Help control)
- Service Key (lowercase, stable): `bug-reports` in the deletion registry and the audit trail; the
  plugin registry tile is `bug-reporting`. Both name the same feature.
- Owner Team: owner (single operator)
- Rollout Stage: shipped on web and Android; admin review page shipped on web.

## 2) Canonical Profile Usage

- Read fields: the signed-in user id (from the auth provider) on submit. The admin list also reads
  `username` from the legacy `public.users` table when that table exists, to show the admin who
  filed each report.
- Write fields: none. Nothing is written to the canonical profile.
- Why canonical fields are needed: the user id scopes the per-person rate limit and lets an admin
  follow up when a "bug report" is really somebody asking for help.

## 3) Plugin Extension Fields

None. The feature keeps no per-member settings or profile fields; it stores reports only.

## 4) Domain Data Owned by Plugin

### `bug_reports` — one row per report

- Contains personal data? Yes.
  - `user_id` — the reporter's user id.
  - `raw_message`, `raw_context` — the person's own words, exactly as typed (trimmed, cut to 5000
    characters each). May contain anything the person chose to write, including their name, contact
    details or circumstances.
  - `user_agent` — the browser or app description sent with the request (cut to 512).
  - `page_url`, `plugin_slug`, `app_version` — where the report was filed from (cut to 512).
  - `redacted_message`, `redacted_context` — the same text with card-like numbers, token-like
    strings, email addresses and phone numbers replaced by placeholders. Names, addresses and other
    free-text details are not removed by this step.
  - `risk_flags`, `risk_level`, `status`, `triage_repo`, `issue_number`, `issue_url`,
    `created_at`, `updated_at`.
- Who can see it in the app: only admins, on `/admin/bug-reports`, and only the redacted text plus
  the reporter's username and a display handle. No route returns `raw_message` or `raw_context` to
  an admin. The reporter can read their own rows, raw text included, through the data export in
  section 9.
- Retention period: no time limit. Reports are kept until the database row is removed by hand; no
  job deletes or ages them out.
- Legal/compliance note: the raw text is the private record and is never published. Only the
  redacted copy leaves the app, and only into a private repository (section 6).

### `bug_report_admin_audit_trail` — one row per admin resolve decision

- Contains personal data? Only the deciding admin's user id (`actor_id`). It holds no report text
  and no reporter id.
- Retention period: no time limit.
- Not listed in the deletion registry, so no deletion touches it: it stays when anyone deletes their
  account, including the admin named in it.

## 5) Service-Scoped Deletion Contract

Not supported. The registry entry sets `serviceScopeSupported: false`, because reports can name any
plugin and there is no per-service slice of them.

- `DELETE /api/account/services/bug-reports` is refused by the route's own check with 409 and code
  `ACCOUNT_SERVICE_SCOPE_UNSUPPORTED` ("cannot be deleted on its own; it is settled only as part of
  full-account deletion"). The orchestrator has the same check and would also write an account audit
  entry with reason `service_scope_not_supported`, but the route refuses first, so that entry is not
  reached through this route.
- Delete immediately: nothing.
- Anonymize/pseudonymize: nothing.
- Retain: everything.
- User-facing confirmation text: none; the bug-reports entry cannot be deleted on its own.

## 6) Full-Account Deletion Contract

When a member deletes their account, the `bug-reports` entry runs one statement:

```sql
UPDATE bug_reports SET user_id = 'deleted_member' WHERE user_id = $1
```

- Every report the member filed stays. Only the reporter id is overwritten with the shared
  placeholder `deleted_member`; no other column is cleared.
- What stays in each row after deletion: `raw_message`, `raw_context`, `user_agent`, `page_url`,
  the redacted text, the risk fields, the status and any issue link. If the person wrote
  identifying details into the report itself, those stay too.
- The reason recorded in the registry: a report is triage input the owner still needs after the
  reporter leaves, and it may already be copied into a triage issue.
- After deletion the admin list shows the report with a null username (the join on `users.id` no
  longer matches) and the handle derived from `deleted_member`, which is the same handle for every
  deleted reporter.
- Second run: finds no rows, because the first run already replaced the id.
- The account deletion itself is recorded in `account_deletion_events`, like every other account
  deletion.

### Copies outside the app, which deletion does not reach

- **The private triage repo.** `ctf/scripts/createBugReportIssues.mjs`
  (`.github/workflows/bug-reports-create-issues.yml`, every 30 minutes) copies each `new` report
  into an issue in the private triage repo (`BUG_REPORTS_TRIAGE_REPO`, default
  `chargingthefuture/bug-reports`). The issue holds the redacted message and context, the report id,
  the page, the plugin, the app version and the filing time. It never holds the raw text, the user
  id or the user agent. Account deletion does not edit, close or delete that issue: there is no
  `bug-reports` entry in `ctf/packages/web/lib/account/external-cleanup-registry.ts`. The issue,
  and anything written on it later (triage comments, linked pull requests), stays in GitHub until
  someone removes it there by hand.
- **The model provider.** `ctf/scripts/triageBugReportIssues.mjs`
  (`.github/workflows/bug-reports-triage.yml`) sends each triage issue's title and body, which is the
  redacted copy above, to the Anthropic API to draft a fix plan. Nothing in the app can recall that.
- A report that was `rejected`, or still `held_for_review`, was never copied out, so the database
  row is its only copy.

- Cross-service dependencies: none that deletion affects. The only other reader of `bug_reports`
  is the admin landing badge (`ctf/packages/web/lib/admin/area-attention.ts`), which counts rows and
  reads no text or reporter id.
- Final expected state: the member's reports remain as unattributed triage records in
  `bug_reports`, plus any redacted copies already in the triage repo.

## 7) Rejoin/Re-enable Behavior

- Recreated defaults: none; there is nothing to set up. A returning person can file reports at once.
- Data that is not restored: earlier reports are not linked back to a new account, because their
  `user_id` is now `deleted_member`.
- Re-consent required? No.

## 8) Audit and Events

- Deletion event: the shared account deletion record (`account_deletion_events`) and the account
  audit log; the bug-reports entry adds nothing of its own. The per-table row count for
  `bug_reports` (action `pseudonymize`) is part of the deletion result.
- Admin decisions on reports: `bug_report_admin_audit_trail`, described in
  `BUG_REPORTING_PLUGIN_AUDIT_CONTRACTS.yaml`.
- Who can trigger deletion: the member, for their own account.
- Alerting/monitoring: failures go through the shared observability channel (`reportError`) with an
  area and operation name; the routes do not add the report text to those calls.

## 9) API and UX Surface

- Service delete endpoint: `DELETE /api/account/services/bug-reports` — refused, see section 5.
- Full account delete endpoint: `DELETE /api/account/full-account`.
- Export: `GET /api/account/services/bug-reports/export` (this feature only) and
  `GET /api/account/full-account/export` (everything). Both include every `bug_reports` row whose
  `user_id` is the member's, with all columns as stored (`SELECT *`), so the member receives their
  own raw text, the redacted copy, the risk flags, the status, the user agent and any issue link. The
  service export is allowed even though service deletion is not. `bug_report_admin_audit_trail` is
  not exported, because it has no reporter column. Rows already set to `deleted_member` are no
  longer anyone's to export.
- Status model: the shared account deletion flow; this feature adds none.
- Summary the account services list returns for this entry (`dataSummary`, read by
  `GET /api/account/services`): "Bug reports you filed (kept for triage with your identity
  removed)."

## 10) Migration and Rollback

- Migration file(s): both tables are defined in `ctf/schema.sql` with `CREATE TABLE IF NOT EXISTS`
  and one `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` per column.
- Rollback approach: none needed for this document; it changes no code or schema.
- Backfill required? No.

## 11) Sign-off Checklist

- [ ] Product approved data behavior
- [ ] Engineering reviewed schema boundaries
- [ ] Compliance/privacy reviewed retention and deletion
- [x] Observability added (without sensitive payloads)
- [x] Web and Android parity confirmed (Android submits through the same route)
