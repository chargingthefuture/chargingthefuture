import { NextResponse } from 'next/server';
import { markFullAccountDeletionRequested } from 'lib/chyme/repository';
import { logChymeAudit } from 'lib/chyme/audit';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { deleteAllAccountData } from 'lib/account/deletion-orchestrator';
import { deleteAuthIdentity } from 'lib/account/identity-deletion';
import { requireAccountAccess, ensureMutationCsrf } from '../_lib';
import { reportError } from 'lib/observability/report';
import { ACCOUNT_ERROR_CODE, FULL_ACCOUNT_CONFIRM_PHRASE, isFullAccountConfirmPhrase } from 'lib/account/constants';

// The typed confirmation, required here as well as on the screen (issue #2697). An Android build
// from before this check sends no body and is refused with this message, which its screen shows.
async function readConfirmPhrase(request: Request): Promise<unknown> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === 'object' ? (body as { confirmPhrase?: unknown }).confirmPhrase : undefined;
  } catch {
    // An empty or unreadable body has no phrase; the caller answers that as a missing confirmation.
    return undefined;
  }
}

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

  if (!isFullAccountConfirmPhrase(await readConfirmPhrase(request))) {
    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: userId,
      status: 'deny',
      reason: 'confirm_phrase_missing',
      target: { scope: 'account' },
      result: 'failure',
      errorCategory: 'validation_error',
    });
    return NextResponse.json(
      {
        ok: false,
        code: ACCOUNT_ERROR_CODE.confirmPhraseRequired,
        message: `Nothing was deleted: type "${FULL_ACCOUNT_CONFIRM_PHRASE}" to confirm. If you are using the Android app, install its latest version first.`,
      },
      { status: 400 },
    );
  }

  // Which step is running, so a failure says whether the data deletion or the credits reclaim
  // request failed instead of one generic message for both (rule 137).
  let step: 'data_deletion' | 'reclaim_request' = 'data_deletion';
  try {
    // Delete the member's data across every plugin first, driven by the deletion registry. Runs in
    // its own transaction; money tables are `retain` in the registry so this never touches the
    // ledger. If it fails, nothing has been queued yet, so a member whose deletion did not happen
    // keeps their account and their credits, and a retry starts clean.
    const requestedAtIso = new Date().toISOString();
    const deletion = await deleteAllAccountData(userId, requestedAtIso);

    // Only after the data deletion has committed, record the request and queue the ServiceCredits
    // reclaim through the adapter outbox (wallets and ledgers are retained, not deleted). Each call
    // writes a new deletion event with its own idempotency key, so this must not run ahead of a
    // deletion that can still fail: a retry would queue a second reclaim.
    step = 'reclaim_request';
    await markFullAccountDeletionRequested(userId);

    // Finally remove the sign-in itself. Deleting the data does not delete the account — the auth
    // provider holds that — so without this a member who asked to be forgotten stays an account they
    // can sign back into, and every roster read from the provider keeps counting them. Runs last and
    // best-effort: the data deletion has already committed, so a provider outage reports itself
    // (`identityRemoved: false` + `identityError`) instead of failing a deletion that did happen. The
    // provider's `user.deleted` webhook fires on success and skips, because the deletion event row
    // written above already exists.
    const identity = await deleteAuthIdentity(userId);
    if (identity.error) {
      reportError(new Error(identity.error), { area: 'account', op: 'full_account_identity_delete' });
    }

    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: userId,
      status: 'allow',
      reason: 'account_deletion_requested',
      target: {
        scope: 'account',
        identityRemoved: String(identity.deleted),
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
        identityRemoved: identity.deleted,
        identityError: identity.error,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'account', op: 'full_account', extra: { step } });
    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: userId,
      status: 'allow',
      reason: 'account_deletion_requested',
      target: {
        scope: 'account',
        step,
      },
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      {
        ok: false,
        code: CHYME_ERROR_CODE.persistenceUnavailable,
        step,
        message:
          step === 'data_deletion'
            ? 'Unable to complete full-account deletion: deleting your data failed, so nothing was removed.'
            : 'Unable to complete full-account deletion: your data was deleted, but the credits reclaim could not be queued.',
      },
      { status: 503 },
    );
  }
}
