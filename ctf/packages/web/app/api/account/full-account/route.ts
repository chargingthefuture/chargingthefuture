import { NextResponse } from 'next/server';
import { markFullAccountDeletionRequested } from 'lib/chyme/repository';
import { deleteChymeStreamData } from 'lib/chyme/stream';
import { logChymeAudit } from 'lib/chyme/audit';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { deleteAllAccountData } from 'lib/account/deletion-orchestrator';
import { requireAccountAccess, ensureMutationCsrf } from '../_lib';
import { reportError } from 'lib/observability/report';

export async function DELETE(request: Request) {
  // Share the centralized account auth contract with the per-service delete route so the two
  // deletion endpoints can't drift in policy or response shape.
  const gate = await requireAccountAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const userId = gate.auth.userId;

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    // First record the request and queue the ServiceCredits reclaim (money settlement runs through
    // the existing adapter outbox; wallets/ledgers are retained, not deleted). This stays in place
    // exactly as before so the financial flow is unchanged. The reclaim insert is idempotent on its
    // deletion-request key, so a client retry re-queues the same reclaim rather than double-settling.
    const reclaim = await markFullAccountDeletionRequested(userId);

    // Then actually delete the user's data across every plugin, driven by the deletion registry.
    // Runs in its own transaction; money tables are `retain` in the registry so this never touches
    // the ledger. The request timestamp from above is the canonical "requested at"; the orchestrator
    // stamps completion separately.
    const deletion = await deleteAllAccountData(userId, reclaim.requestedAtIso);

    // The registry-driven orchestrator deletes Postgres rows only; it has no hook for external stores.
    // Chyme fans its chat messages out to Stream, so clear the member's Stream copy too. Best-effort
    // and after the DB delete: a Stream outage must not fail the account deletion the user completed.
    const streamCleared = await deleteChymeStreamData(userId);
    if (!streamCleared) {
      reportError(new Error('Chyme Stream data was not cleared on full-account deletion'), {
        area: 'account',
        op: 'full_account_stream_cleanup',
        extra: { userId },
      });
    }

    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: userId,
      status: 'allow',
      reason: 'account_deletion_requested',
      target: {
        scope: 'account',
        streamCleared: streamCleared ? 'yes' : 'no',
      },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json(
      {
        ok: true,
        scope: 'account',
        status: 'completed',
        requestedAtIso: deletion.requestedAtIso,
        completedAtIso: deletion.completedAtIso,
        tablesAffected: deletion.tables.length,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'account', op: 'full_account' });
    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: userId,
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
