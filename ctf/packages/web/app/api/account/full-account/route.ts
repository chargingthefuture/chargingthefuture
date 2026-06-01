import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { markFullAccountDeletionRequested } from 'lib/chyme/repository';
import { logChymeAudit } from 'lib/chyme/audit';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { deleteAllAccountData } from 'lib/account/deletion-orchestrator';
import { ensureMutationCsrf } from '../_lib';

export async function DELETE(request: Request) {
  const decision = await evaluatePluginAccess({
    requireUsername: false,
    requireApprovedUserOrAdmin: false,
    allowUnlockSupportOnly: true,
  });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    // First record the request and queue the ServiceCredits reclaim (money settlement runs through
    // the existing adapter outbox; wallets/ledgers are retained, not deleted). This stays in place
    // exactly as before so the financial flow is unchanged.
    const reclaim = await markFullAccountDeletionRequested(decision.userId);

    // Then actually delete the user's data across every plugin, driven by the deletion registry.
    // Runs in its own transaction; money tables are `retain` in the registry so this never touches
    // the ledger.
    const deletion = await deleteAllAccountData(decision.userId);

    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: decision.userId,
      status: 'allow',
      reason: 'account_deletion_requested',
      target: {
        scope: 'account',
      },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json(
      {
        ok: true,
        scope: 'account',
        status: 'completed',
        requestedAtIso: reclaim.requestedAtIso,
        completedAtIso: deletion.requestedAtIso,
        tablesAffected: deletion.tables.length,
      },
      { status: 200 },
    );
  } catch {
    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: decision.userId,
      status: 'allow',
      reason: 'account_deletion_requested',
      target: {
        scope: 'account',
      },
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      {
        ok: false,
        code: CHYME_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to complete full-account deletion.',
      },
      { status: 503 },
    );
  }
}
