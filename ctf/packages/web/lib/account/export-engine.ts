// Account data-export engine — the read-side twin of the deletion engine (issue #1264). Turns a
// plugin's entry in the account deletion registry into the SELECT statements that read that user's
// rows, and runs them.
//
// Mirrors `deletion-engine.ts` exactly in structure and safety properties: `planTableExport` is a
// pure function (no database, no clock) so its output can be checked exactly — see
// `ctf/scripts/check-export-engine.mjs`, which asserts the generated SQL for every registry entry
// without needing a database. `executeExportEntry` is the thin part that runs the plan against a
// live client.
//
// Scope (issue #1264, decision 2a — MVP): only tables with a `userColumn` are exported, i.e. the
// registry's `delete` and `soft-delete` tables. `retain` tables (money ledgers, audit trails,
// shared content) record no user column today, so they are skipped; including user-owned retained
// rows (e.g. the ServiceCredits ledger) is the follow-up once per-table export columns are
// reviewed. The export envelope says this in its `notes` so the file is honest about what it holds.
//
//   - delete / soft-delete → SELECT * FROM <table> WHERE <userColumn> = $1
//   - retain               → no operation
//
// Identifiers (table / column names) come only from the registry, which is itself validated
// against `schema.sql` by `check-deletion-registry.mjs`, so they are never user input. The user id
// is always the bound parameter `$1`, never inlined — a member can only ever read their own rows.

import type { PoolClient } from 'pg';
import type { OwnedTable, PluginDeletionEntry } from './deletion-registry';

/** A single read statement produced from one owned table. */
export type ExportStatement = {
  /** Real table this reads from. */
  readonly table: string;
  /** The column that scopes the read to the requesting user. */
  readonly userColumn: string;
  /** Parameterized SQL with `$1` bound to the user id. */
  readonly sql: string;
};

/**
 * Pure translation of one owned table into a SELECT statement, or `null` when the table has no
 * user column to scope by (`retain` tables — skipped in the MVP export scope).
 */
export function planTableExport(owned: OwnedTable): ExportStatement | null {
  if (!owned.userColumn) {
    return null;
  }
  return {
    table: owned.table,
    userColumn: owned.userColumn,
    sql: `SELECT * FROM ${owned.table} WHERE ${owned.userColumn} = $1`,
  };
}

/**
 * Pure plan for a whole plugin entry: the ordered list of read statements (unscoped `retain`
 * tables dropped), in registry order.
 */
export function planExport(entry: PluginDeletionEntry): ExportStatement[] {
  const statements: ExportStatement[] = [];
  for (const owned of entry.tables) {
    const statement = planTableExport(owned);
    if (statement) {
      statements.push(statement);
    }
  }
  return statements;
}

/** Whether a registry entry has anything a personal export can read (≥1 user-scoped table). */
export function isExportable(entry: PluginDeletionEntry): boolean {
  return planExport(entry).length > 0;
}

/** Per-table result of running an export: the rows exactly as stored, scoped to this user. */
export type ExportTableResult = {
  readonly table: string;
  /** The column the rows were scoped by (self-describing for the reader of the file). */
  readonly userColumn: string;
  readonly rowCount: number;
  /** The user's own rows. Date values serialize to ISO strings via JSON.stringify. */
  readonly rows: Record<string, unknown>[];
};

/** One service's export: its identity plus every user-scoped table's rows. */
export type ExportServiceResult = {
  readonly slug: string;
  readonly name: string;
  readonly tables: readonly ExportTableResult[];
};

/**
 * Run a plugin entry's export plan against a client. Read-only; the caller may batch several
 * entries on one client/transaction for a consistent snapshot. Returns the per-table rows.
 */
export async function executeExportEntry(
  client: PoolClient,
  entry: PluginDeletionEntry,
  userId: string,
): Promise<ExportServiceResult> {
  const tables: ExportTableResult[] = [];
  for (const statement of planExport(entry)) {
    const result = await client.query<Record<string, unknown>>(statement.sql, [userId]);
    tables.push({
      table: statement.table,
      userColumn: statement.userColumn,
      rowCount: result.rowCount ?? 0,
      rows: result.rows,
    });
  }
  return { slug: entry.slug, name: entry.name, tables };
}
