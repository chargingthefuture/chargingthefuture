import { NextResponse } from 'next/server';
import { requireAccountAccess } from '../_lib';
import { accountDeletionRegistry } from 'lib/account/deletion-registry';
import { isExportable } from 'lib/account/export-engine';

// Read-only projection of the account deletion registry for the Account & Data UI.
//
// The registry (`lib/account/deletion-registry.ts`) is the single source of truth for which
// services hold a user's data, their human-readable names, the one-line data summary shown to the
// user, and whether each service can be deleted on its own ("service" scope). This endpoint simply
// surfaces that — it stores no copy of its own and performs no deletion. The actual deletes happen
// through `DELETE /api/account/services/:slug` and `DELETE /api/account/full-account`.
//
// Services split into two lists for the UI:
//   - `deletable`  — `serviceScopeSupported === true`; the user can delete this data independently.
//   - `retained`   — `serviceScopeSupported === false`; honestly shown as "kept by design" with the
//                    registry's own reason (money/ledger integrity for ServiceCredits; aggregate-only
//                    community totals for GDP / Weekly Performance).
//
// GET /api/account/services
export async function GET() {
  const gate = await requireAccountAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  // `exportable` marks services with at least one user-scoped table, i.e. where the JSON export
  // (GET /api/account/services/:slug/export) has anything to read — independent of whether the
  // service supports standalone deletion (e.g. Notifications is retained-scope for delete but
  // still holds the member's own exportable rows).
  const deletable = accountDeletionRegistry
    .filter((entry) => entry.serviceScopeSupported)
    .map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      summary: entry.dataSummary,
      serviceScopeSupported: true as const,
      exportable: isExportable(entry),
    }));

  const retained = accountDeletionRegistry
    .filter((entry) => !entry.serviceScopeSupported)
    .map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      summary: entry.dataSummary,
      serviceScopeSupported: false as const,
      exportable: isExportable(entry),
    }));

  return NextResponse.json(
    {
      ok: true,
      deletable,
      retained,
      counts: {
        deletable: deletable.length,
        retained: retained.length,
        total: deletable.length + retained.length,
      },
    },
    { status: 200 },
  );
}
