import { NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/backend';
import { markFullAccountDeletionRequested } from 'lib/chyme/repository';
import { logChymeAudit } from 'lib/chyme/audit';
import { deleteAllAccountData } from 'lib/account/deletion-orchestrator';
import { getClerkSecretKey } from 'lib/auth/clerk-env';
import { reportError } from 'lib/observability/report';

// Operator-only: delete ANY user's account by id, for clearing duplicate accounts the owner finds.
// This is the admin counterpart to the self-service `DELETE /api/account/full-account` route: it runs
// the exact same flow (record the request + queue the ServiceCredits reclaim, then delete every
// plugin's data via the deletion registry/orchestrator) but the target user id comes from the request
// body instead of the signed-in caller, and it optionally deletes the Clerk account too.
//
// Guarded by a dedicated `ACCOUNT_DELETE_SECRET` (Bearer) — NOT the cron secret — because deletion is
// irreversible and must not share a credential with the benign weekly-assignment cron. Called only by
// the manual `Delete Account (manual)` GitHub Actions workflow. Money is never touched here: wallets
// and ledgers are `retain` in the registry and settled by the existing reclaim flow.
const OPERATOR_ACTOR_ID = 'account-deletion-operator';

function isAuthorized(request: Request): boolean {
  const secret = process.env.ACCOUNT_DELETE_SECRET;
  if (!secret || secret.trim().length === 0) {
    return false;
  }
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  // Distinguish "not configured" (503 — secret missing in the app runtime) from "wrong/no secret"
  // (403) so the workflow's error message can point at the right fix.
  if (!process.env.ACCOUNT_DELETE_SECRET || process.env.ACCOUNT_DELETE_SECRET.trim().length === 0) {
    return NextResponse.json(
      { ok: false, code: 'account_delete_not_configured', message: 'ACCOUNT_DELETE_SECRET is not set in the app runtime.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, code: 'account_delete_forbidden', message: 'Invalid account-delete secret.' },
      { status: 403 },
    );
  }

  let body: { userId?: unknown; deleteClerk?: unknown };
  try {
    body = (await request.json()) as { userId?: unknown; deleteClerk?: unknown };
  } catch {
    body = {};
  }
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (userId.length === 0) {
    return NextResponse.json(
      { ok: false, code: 'account_delete_bad_request', message: 'userId is required.' },
      { status: 400 },
    );
  }
  // Default true: a duplicate account should be fully gone (data + Clerk identity) in one run. Pass
  // `{ "deleteClerk": false }` to delete only the database data and keep the Clerk account.
  const deleteClerk = body.deleteClerk !== false;

  try {
    const reclaim = await markFullAccountDeletionRequested(userId);
    const deletion = await deleteAllAccountData(userId, reclaim.requestedAtIso);

    let clerkDeleted = false;
    let clerkError: string | null = null;
    if (deleteClerk) {
      const secretKey = getClerkSecretKey();
      if (!secretKey) {
        clerkError = 'clerk_secret_not_configured';
      } else {
        try {
          await createClerkClient({ secretKey }).users.deleteUser(userId);
          clerkDeleted = true;
        } catch (error) {
          // The DB deletion already succeeded; surface the Clerk failure without failing the request
          // so the operator can retry just the Clerk side (e.g. the user was already removed there).
          clerkError = error instanceof Error ? error.message : 'clerk_delete_failed';
        }
      }
    }

    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: OPERATOR_ACTOR_ID,
      status: 'allow',
      reason: 'operator_account_deletion',
      target: { scope: 'account', userId, clerkDeleted: String(clerkDeleted) },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({
      ok: true,
      userId,
      scope: 'account',
      status: 'completed',
      tablesAffected: deletion.tables.length,
      requestedAtIso: deletion.requestedAtIso,
      completedAtIso: deletion.completedAtIso,
      clerkDeleted,
      clerkError,
    });
  } catch (error) {
    reportError(error, { area: 'account', op: 'operator_delete' });
    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: OPERATOR_ACTOR_ID,
      status: 'allow',
      reason: 'operator_account_deletion',
      target: { scope: 'account', userId },
      result: 'failure',
      errorCategory: 'persistence_error',
    });
    return NextResponse.json(
      { ok: false, code: 'account_delete_failed', message: 'Unable to complete operator account deletion.' },
      { status: 503 },
    );
  }
}
