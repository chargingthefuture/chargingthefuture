// Account deletion engine — turns a plugin's entry in the account deletion registry into the
// concrete database operations that delete (or soft-delete) that user's data, and runs them.
//
// A `delete` entry may also carry a `rowFilter`, which is ANDed onto the user-column match so only
// some of the member's rows in a shared table are removed (`feed_items` holds both the member's own
// Commons post copies and the admin announcement copies).
//
// This is split from the orchestrator on purpose: `planDeletion` is a pure function (no database,
// no clock, no randomness) so its output can be checked exactly — see
// `ctf/scripts/check-deletion-engine.mjs`, which asserts the generated SQL for every registry
// entry without needing a database. `executeEntry` is the thin part that actually runs the plan
// against a live transaction.
//
// The registry is the single source of truth for which tables a user owns and how each is handled;
// this file only knows how to translate those three actions into SQL:
//   - delete       → DELETE FROM <table> WHERE <userColumn> = $1
//   - soft-delete  → UPDATE <table> SET <softDeleteColumn> = NOW()
//                      WHERE <userColumn> = $1 AND <softDeleteColumn> IS NULL
//   - release-claim → UPDATE <table> SET <userColumn> = NULL, <clearColumns> = NULL
//                      WHERE <userColumn> = $1 AND <authorColumn> <> '<authoredValue>'
//   - retain       → no operation (money ledgers, audit trails, shared content)
//
// Tables in each registry entry are already ordered child-before-parent, so plain deletes respect
// foreign keys when run in order.

import type { PoolClient } from 'pg';
import { DELETED_MEMBER_PLACEHOLDER, type OwnedTable, type PluginDeletionEntry } from './deletion-registry';

/** A single database operation produced from one owned table. */
export type DeletionStatement = {
  /** Real table this operates on. */
  readonly table: string;
  /** Which registry action produced it. */
  readonly action: 'delete' | 'soft-delete' | 'release-claim' | 'pseudonymize';
  /** Parameterized SQL with `$1` bound to the user id. */
  readonly sql: string;
};

/** The `delete` branch of `planTable`, kept separate so the switch stays simple to read. */
function planDelete(owned: OwnedTable): DeletionStatement {
  if (!owned.userColumn) {
    throw new Error(`Table "${owned.table}" is action "delete" but has no userColumn.`);
  }
  // An optional registry-authored row filter narrows the delete to some of the member's rows in
  // a table that also holds rows nobody should lose (see `delWhere` in the registry). It never
  // widens the delete: the user-column match stays, and the filter is only ANDed onto it.
  const rowFilter = owned.rowFilter ? ` AND (${owned.rowFilter})` : '';
  return {
    table: owned.table,
    action: 'delete',
    sql: `DELETE FROM ${owned.table} WHERE ${owned.userColumn} = $1${rowFilter}`,
  };
}

/** The `soft-delete` branch of `planTable`, kept separate so the switch stays simple to read. */
function planSoftDelete(owned: OwnedTable): DeletionStatement {
  if (!owned.userColumn) {
    throw new Error(`Table "${owned.table}" is action "soft-delete" but has no userColumn.`);
  }
  if (!owned.softDeleteColumn) {
    throw new Error(`Table "${owned.table}" is action "soft-delete" but has no softDeleteColumn.`);
  }
  // A soft-delete may be narrowed to the rows the member authored, leaving the ones they only
  // claimed to `release-claim` on the same table. Like the row filter above, this can only narrow:
  // the user-column match and the idempotence guard both stay.
  const authored = authoredClause(owned, '=');
  return {
    table: owned.table,
    action: 'soft-delete',
    sql:
      `UPDATE ${owned.table} SET ${owned.softDeleteColumn} = NOW() ` +
      `WHERE ${owned.userColumn} = $1 AND ${owned.softDeleteColumn} IS NULL${authored}`,
  };
}

/** The `release-claim` branch of `planTable`, kept separate so the switch stays simple to read. */
function planReleaseClaim(owned: OwnedTable): DeletionStatement {
  if (!owned.userColumn) {
    throw new Error(`Table "${owned.table}" is action "release-claim" but has no userColumn.`);
  }
  if (!owned.clearColumns?.length) {
    throw new Error(`Table "${owned.table}" is action "release-claim" but clears no columns.`);
  }
  if (!owned.authorColumn || !owned.authoredValue) {
    throw new Error(`Table "${owned.table}" is action "release-claim" but has no authorColumn/authoredValue pair.`);
  }
  // Let the row go rather than deleting it: drop the link to this member and NULL whatever they
  // could have filled in themselves, leaving the row in the unclaimed state it held before.
  //
  // The WHERE still matches the REAL id and excludes rows the member authored, so this is
  // idempotent — the first run clears the id and a second finds nothing.
  const sets = [`${owned.userColumn} = NULL`, ...owned.clearColumns.map((column) => `${column} = NULL`)];
  return {
    table: owned.table,
    action: 'release-claim',
    sql: `UPDATE ${owned.table} SET ${sets.join(', ')} ` + `WHERE ${owned.userColumn} = $1${authoredClause(owned, '<>')}`,
  };
}

/**
 * The ` AND <authorColumn> <op> '<authoredValue>'` clause shared by the two actions that split one
 * table by who wrote a row. Returns '' when the registry entry declares no author pair, so every
 * existing entry renders exactly the SQL it did before.
 *
 * The column and the value come only from the registry, which `check-deletion-registry.mjs` checks
 * against `schema.sql` and holds to a plain slug, so neither is user input.
 */
function authoredClause(owned: OwnedTable, op: '=' | '<>'): string {
  if (!owned.authorColumn || !owned.authoredValue) {
    return '';
  }
  return ` AND ${owned.authorColumn} ${op} '${owned.authoredValue}'`;
}

/**
 * Pure translation of one owned table into a SQL statement, or `null` for `retain` (no-op).
 *
 * Identifiers (table / column names) come only from the registry, which is itself validated
 * against `schema.sql` by `check-deletion-registry.mjs`, so they are never user input — they are
 * safe to interpolate. The user id is always passed as the bound parameter `$1`, never inlined.
 */
export function planTable(owned: OwnedTable): DeletionStatement | null {
  switch (owned.action) {
    case 'retain':
      return null;
    case 'delete':
      return planDelete(owned);
    case 'soft-delete':
      return planSoftDelete(owned);
    case 'release-claim':
      return planReleaseClaim(owned);
    case 'pseudonymize': {
      if (!owned.userColumn) {
        throw new Error(`Table "${owned.table}" is action "pseudonymize" but has no userColumn.`);
      }
      // Overwrite the id, and NULL any denormalized copies of the member's identity alongside it —
      // clearing the id while leaving a captured handle would defeat the whole point.
      //
      // The WHERE still matches the REAL id, so this is naturally idempotent: a second run finds no
      // rows, because the first already replaced them with the placeholder.
      const sets = [
        `${owned.userColumn} = '${DELETED_MEMBER_PLACEHOLDER}'`,
        ...(owned.clearColumns ?? []).map((column) => `${column} = NULL`),
      ];
      return {
        table: owned.table,
        action: 'pseudonymize',
        sql: `UPDATE ${owned.table} SET ${sets.join(', ')} WHERE ${owned.userColumn} = $1`,
      };
    }
    default: {
      // Exhaustiveness guard: a new action must be handled here explicitly.
      const unreachable: never = owned.action;
      throw new Error(`Unhandled deletion action: ${String(unreachable)}`);
    }
  }
}

/**
 * Pure plan for a whole plugin entry: the ordered list of statements to run (retains dropped),
 * preserving the registry's child-before-parent ordering.
 */
export function planDeletion(entry: PluginDeletionEntry): DeletionStatement[] {
  const statements: DeletionStatement[] = [];
  for (const owned of entry.tables) {
    const statement = planTable(owned);
    if (statement) {
      statements.push(statement);
    }
  }
  return statements;
}

/** Per-table outcome of running a deletion, for the audit/event record. */
export type DeletionTableResult = {
  readonly table: string;
  readonly action: 'delete' | 'soft-delete' | 'release-claim' | 'pseudonymize';
  /** Rows affected (deleted or soft-deleted). */
  readonly rowCount: number;
};

/**
 * Run a plugin entry's deletion plan against an open transaction client. The caller owns the
 * transaction (begin/commit/rollback) so several plugins can be deleted atomically in one account
 * deletion. Returns the per-table row counts.
 */
export async function executeEntry(
  client: PoolClient,
  entry: PluginDeletionEntry,
  userId: string,
): Promise<DeletionTableResult[]> {
  const results: DeletionTableResult[] = [];
  for (const statement of planDeletion(entry)) {
    const result = await client.query(statement.sql, [userId]);
    results.push({
      table: statement.table,
      action: statement.action,
      rowCount: result.rowCount ?? 0,
    });
  }
  return results;
}
