# Account Deletion Registry

This note explains `ctf/packages/web/lib/account/deletion-registry.ts` — the single source of truth
that maps each plugin to the database tables holding a user's data, and how each table is handled
when a user deletes either just that plugin's data ("service" scope) or their whole CTF account
("account" scope).

This is the foundation the future account-deletion orchestrator, the per-plugin "delete my data"
routes, and the (design-gated) Account & Data UI all build on. It deletes nothing by itself — it is
data plus helper functions.

## Why a registry built from the schema, not the contracts

Each plugin has a deletion *contract* under `ctf/docs/contracts/*_PROFILE_AND_DELETION_CONTRACT.md`.
Those contracts describe intended/draft schemas that have **drifted** from the tables actually
shipped in `ctf/schema.sql`. If we targeted the contract names we would silently fail to delete real
data (or error on tables that do not exist). So the registry is keyed to reality and verified by a CI
check. Examples of drift the registry corrects:

- `gdp_user_extension` does not exist — GDP stores no per-user data, so it has nothing to delete.
- Feed tables key authorship by `author_user_id` / `asked_by_user_id`, not `user_id`.
- `socket_relay_requests` uses `owner_user_id`; TrustTransport uses `requester_user_id` /
  `provider_user_id`; Foundation threads use `created_by_user_id` / `sender_user_id`.

## How each table is handled

| Action | Meaning |
|---|---|
| `delete` | Hard-delete the user's rows (`DELETE FROM <table> WHERE <userColumn> = $1`). |
| `delete` with a row filter | Hard-delete only *some* of the user's rows in a table that also holds rows nobody should lose: `... WHERE <userColumn> = $1 AND (<rowFilter>)`. Written with the `delWhere()` builder. The filter only ever narrows the delete — the user-column match stays. |
| `soft-delete` | Stamp the configured `softDeleteColumn` instead of removing the row. |
| `retain` | Keep the rows. Used for money/ledger tables (financial integrity), deletion-event and audit-trail tables (the accountability record of the deletion), and shared platform content. |

Conservative-by-default, because deletion is irreversible:

- **Money / ledger** tables are retained. ServiceCredits is reclaimed and tombstoned only through the
  existing account-deletion reclaim flow (`service_credits_account_deletion_reclaims` +
  `service_credits_wallet_tombstones`), never hard-deleted here. TrustTransport and LevelUp money
  tables are likewise retained.
- **Deletion-event / audit-trail** tables are retained — they exist to be the record of the deletion.
- **Shared platform content** authored by a user but consumed by others (admin announcements,
  property listings, cohorts, missions) is retained and flagged with a `reviewNote` for an explicit
  product decision rather than silently cascaded.
- **A member's own words are not "retained under a generic name".** Renaming the author while the
  text stays on screen is not a deletion. `feed_items` is the case that taught this: it holds both
  the Commons copy of a member's post and the copy of an admin announcement, and retaining the whole
  table left deleted members' posts on the Commons re-labeled `user-hub-syst` (owner report,
  2026-08-09). A table that mixes the two kinds gets a `delWhere()` row filter that separates them,
  not a blanket `retain`.
- **Global catalog/aggregate** tables (currencies, taxonomy, GDP metrics, weekly-performance
  aggregates) are not listed — they are not any individual user's data.

## The CI guard

`ctf/scripts/check-deletion-registry.mjs` parses `ctf/schema.sql` and checks every `table`,
`userColumn`, and `softDeleteColumn` named in the registry actually exists. A `delWhere()` row filter
is checked the same way: it must be made only of `<column> IS [NOT] NULL` clauses joined by AND/OR,
and every column in it must exist on that table. It runs in the Schema Drift Gate job in
`.github/workflows/ci.yml`, so the registry cannot drift from the schema again. It is plain Node (no
TypeScript import), so it runs on any Node version, including the Node 20 runners.

To run locally:

```sh
node ctf/scripts/check-deletion-registry.mjs
```

## The engine and orchestrator

The registry is data; two small modules turn it into action:

- **`deletion-engine.ts`** — a pure translator. `planTable` / `planDeletion` turn a registry entry
  into the exact SQL to run (`DELETE FROM <table> WHERE <userColumn> = $1`, with
  ` AND (<rowFilter>)` appended when the registry narrows it, or an idempotent
  `UPDATE ... SET <softDeleteColumn> = NOW() WHERE <userColumn> = $1 AND <softDeleteColumn> IS NULL`,
  or nothing for `retain`). Because it is pure, its output is checked without a database by
  `ctf/scripts/check-deletion-engine.mjs` (run in CI). `executeEntry` runs the plan against an open
  transaction.
- **`deletion-orchestrator.ts`** — `deleteServiceScopeData(slug, userId)` deletes one plugin's data;
  `deleteAllAccountData(userId)` deletes every plugin's data. Both run inside a single
  `withDbTransaction` (so a failure rolls back rather than half-deleting a user), record one
  `account_deletion_events` row, and log an `[account.audit]` line. Identifiers come only from the
  registry; the user id is always the bound parameter `$1`, never inlined.

Money is out of scope for the engine. ServiceCredits wallets/ledgers are `retain` in the registry
and are settled by the existing reclaim flow (`markFullAccountDeletionRequested` →
`enqueueServiceCreditsDeletionReclaim` → the service-credits adapter outbox). The full-account route
calls that reclaim flow first, then runs the orchestrator; the engine never moves credits.

## API routes

- `DELETE /api/account/services/:slug` — delete just one plugin's data. The `:slug` is validated
  against the registry; plugins that are not service-scoped (money/aggregate-only) return a clear
  409 instead of a silent no-op.
- `DELETE /api/account/full-account` — record the request, queue the ServiceCredits reclaim, then
  delete the user's data across every plugin.

Both require an authenticated caller (self-service only — a deletion only ever touches the caller's
own rows) and the same-origin `x-ctf-csrf: 1` guard used elsewhere.

- `POST /api/internal/account/delete` — the **operator** counterpart, for clearing a duplicate
  account by id. Runs the same flow as `full-account` (reclaim + `deleteAllAccountData`) but the
  target `userId` comes from the request body, and by default it also deletes the Clerk identity
  (`createClerkClient().users.deleteUser`); pass `{ "deleteClerk": false }` to delete only the
  database data. It is **not** user-authenticated: it is guarded by a dedicated
  `Authorization: Bearer <ACCOUNT_DELETE_SECRET>` (kept separate from `CRON_SECRET` because the action
  is irreversible). Called only by the manual `Delete Account (manual)` GitHub Actions workflow
  (`.github/workflows/delete-account.yml`), which fails red (never skips) when the secret/URL is
  missing so a misfire is never mistaken for a completed deletion.

## What is intentionally NOT here yet

- The **Account & Data UI** (web + mobile) — design-gated; no mockup exists in the `design/`
  submodule yet (Rule 127). The backend above is what that UI will call once its design lands.
