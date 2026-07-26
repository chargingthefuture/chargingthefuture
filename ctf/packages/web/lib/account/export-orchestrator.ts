// Account data-export orchestrator — assembles the downloadable JSON document for a user's data,
// driven entirely by the account deletion registry (issue #1264). The read-side twin of
// `deletion-orchestrator.ts`.
//
// Two entry points:
//   - `exportServiceData(slug, userId)` — one plugin's data for this user.
//   - `exportAllAccountData(userId)`    — every plugin the registry knows, in one document.
//
// Both run the registry-derived SELECT plan inside a single `withDbTransaction`, so the whole file
// is one consistent snapshot. Read-only: nothing here writes, and the audit line is the only side
// effect (emitted by the routes). Unlike deletion, export does NOT require `serviceScopeSupported` —
// that flag is about standalone *deletion* semantics; any registry entry with at least one
// user-scoped table can be read (e.g. Notifications and Contributor Access have no standalone
// delete but do hold a member's own rows).

import { withDbTransaction } from 'lib/db/postgres';
import {
  accountDeletionRegistry,
  getDeletionEntry,
} from './deletion-registry';
import { executeExportEntry, isExportable, type ExportServiceResult } from './export-engine';
import { UnknownServiceError } from './deletion-orchestrator';

export const ACCOUNT_EXPORT_VERSION = 1;

// The honest scope statement embedded in every export file (issue #1264, decision 2a — MVP).
const EXPORT_SCOPE_NOTES = [
  'This file contains only rows scoped to your own user id, read from the same schema-validated registry the delete flow uses.',
  'Money ledgers (e.g. ServiceCredits), audit trails, and shared platform content are retained by design and are not included in this export yet.',
  'Where a row references another member (for example a message recipient), only their id appears — never their profile.',
];

/** The self-describing envelope the export routes serialize to the downloaded JSON file. */
export type AccountExportDocument = {
  readonly exportVersion: number;
  readonly generatedAtIso: string;
  readonly userId: string;
  readonly scope: string;
  readonly services: readonly ExportServiceResult[];
  readonly notes: readonly string[];
};

function buildDocument(userId: string, scope: string, services: ExportServiceResult[]): AccountExportDocument {
  return {
    exportVersion: ACCOUNT_EXPORT_VERSION,
    generatedAtIso: new Date().toISOString(),
    userId,
    scope,
    services,
    notes: EXPORT_SCOPE_NOTES,
  };
}

/**
 * Export one plugin's data for a user. Throws `UnknownServiceError` when the slug is not in the
 * registry (the route maps it to 404). A known service with nothing exportable (aggregate-only or
 * all-retained, e.g. GDP or ServiceCredits) returns an envelope whose one service has zero tables —
 * an honest "no personal rows here", not an error.
 */
export async function exportServiceData(slug: string, userId: string): Promise<AccountExportDocument> {
  const entry = getDeletionEntry(slug);
  if (!entry) {
    throw new UnknownServiceError(slug);
  }

  const service = await withDbTransaction((client) => executeExportEntry(client, entry, userId));
  return buildDocument(userId, `service:${slug}`, [service]);
}

/**
 * Export every service's data for a user in one document. Only registry entries with at least one
 * user-scoped table appear (the others have nothing a personal export can read). One transaction,
 * so the whole file is a consistent snapshot.
 */
export async function exportAllAccountData(userId: string): Promise<AccountExportDocument> {
  const entries = accountDeletionRegistry.filter(isExportable);
  const services = await withDbTransaction(async (client) => {
    const results: ExportServiceResult[] = [];
    for (const entry of entries) {
      results.push(await executeExportEntry(client, entry, userId));
    }
    return results;
  });
  return buildDocument(userId, 'full-account', services);
}
