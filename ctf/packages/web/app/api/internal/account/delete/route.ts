import { NextResponse } from 'next/server';
import { markFullAccountDeletionRequested } from 'lib/chyme/repository';
import { logChymeAudit } from 'lib/chyme/audit';
import { deleteAllAccountData } from 'lib/account/deletion-orchestrator';
import { deleteAuthIdentity } from 'lib/account/identity-deletion';
import { runWithForcedPool } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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

// Correctness-only check: the caller has already confirmed the secret is configured (the 503 guard in
// POST is the single place that checks for presence), so this only compares the supplied Bearer token
// against the known-non-empty secret.
function isAuthorized(request: Request, secret: string): boolean {
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// Presence + Bearer gate. Distinguish "not configured" (503 — secret missing in the app runtime) from
// "wrong/no secret" (403) so the workflow's error message can point at the right fix. This is the ONLY
// presence check; isAuthorized assumes a configured secret and only verifies the supplied token.
// Returns a ready error response, or null when the caller is authorized.
function authorizeRequest(request: Request): NextResponse | null {
  const secret = process.env.ACCOUNT_DELETE_SECRET?.trim() ?? '';
  if (secret.length === 0) {
    return NextResponse.json(
      { ok: false, code: 'account_delete_not_configured', message: 'ACCOUNT_DELETE_SECRET is not set in the app runtime.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json(
      { ok: false, code: 'account_delete_forbidden', message: 'Invalid account-delete secret.' },
      { status: 403 },
    );
  }
  return null;
}

type ParsedDeleteRequest = { userId: string; deleteClerk: boolean; target: 'demo' | 'public'; targetLabel: string };

// Parse + validate the request body and derive the deletion target. Returns a ready error response
// (missing userId) or the validated inputs; status code and code string are unchanged from the inline
// version.
async function parseDeleteRequest(request: Request): Promise<{ error: NextResponse } | { data: ParsedDeleteRequest }> {
  let body: { userId?: unknown; deleteClerk?: unknown; target?: unknown };
  try {
    body = (await request.json()) as { userId?: unknown; deleteClerk?: unknown; target?: unknown };
  } catch {
    body = {};
  }
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (userId.length === 0) {
    return {
      error: NextResponse.json(
        { ok: false, code: 'account_delete_bad_request', message: 'userId is required.' },
        { status: 400 },
      ),
    };
  }
  // Default true: a duplicate account should be fully gone (data + Clerk identity) in one run. Pass
  // `{ "deleteClerk": false }` to delete only the database data and keep the Clerk account.
  const deleteClerk = body.deleteClerk !== false;

  // Which database schema's rows to delete. An internal call has no signed-in user, so demo-mode
  // targeting never applies here — without this it would always hit production. `target: "demo"`
  // pins the whole deletion to the demo schema (via runWithForcedPool) so a demo test account can be
  // fully wiped, using the exact same registry/orchestrator flow as production. Anything other than
  // "demo" (including the default) targets production. The Clerk identity is global (one instance),
  // so `deleteClerk` is independent of this.
  const target = body.target === 'demo' ? 'demo' : 'public';
  const targetLabel = target === 'demo' ? 'demo' : 'production';

  return { data: { userId, deleteClerk, target, targetLabel } };
}

// Optionally delete the Clerk identity after the DB deletion has already succeeded. Runs only when
// requested; a Clerk failure is surfaced (clerkError) without failing the request so the operator can
// retry just the Clerk side (e.g. the user was already removed there). The removal itself is the
// shared `deleteAuthIdentity` the self-service delete route also uses, so the two cannot drift.
async function deleteClerkAccountIfRequested(
  userId: string,
  deleteClerk: boolean,
): Promise<{ clerkDeleted: boolean; clerkError: string | null }> {
  if (!deleteClerk) {
    return { clerkDeleted: false, clerkError: null };
  }
  const outcome = await deleteAuthIdentity(userId);
  return { clerkDeleted: outcome.deleted, clerkError: outcome.error };
}

export async function POST(request: Request) {
  const authError = authorizeRequest(request);
  if (authError) {
    return authError;
  }

  const parsed = await parseDeleteRequest(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const { userId, deleteClerk, target, targetLabel } = parsed.data;

  // Track which step is running so a failure response can say whether the ServiceCredits reclaim
  // request or the data deletion threw — the generic 503 alone was undiagnosable from the Actions log.
  let step = 'reclaim_request';
  try {
    const deletion = await runWithForcedPool(target, async () => {
      const reclaim = await markFullAccountDeletionRequested(userId);
      step = 'data_deletion';
      return deleteAllAccountData(userId, reclaim.requestedAtIso);
    });

    const { clerkDeleted, clerkError } = await deleteClerkAccountIfRequested(userId, deleteClerk);

    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: OPERATOR_ACTOR_ID,
      status: 'allow',
      reason: 'operator_account_deletion',
      target: { scope: 'account', userId, schema: targetLabel, clerkDeleted: String(clerkDeleted) },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({
      ok: true,
      userId,
      scope: 'account',
      schema: targetLabel,
      status: 'completed',
      tablesAffected: deletion.tables.length,
      requestedAtIso: deletion.requestedAtIso,
      completedAtIso: deletion.completedAtIso,
      clerkDeleted,
      clerkError,
    });
  } catch (error) {
    reportError(error, { area: 'account', op: 'operator_delete', extra: { step } });
    // `status` is the POLICY-gate decision (allow/deny), not the outcome — the request passed the
    // secret gate, so it is 'allow' here too. Whether the operation actually completed is carried by
    // `result` ('failure') and `errorCategory`. An audit query for policy denials keys off `status`
    // = 'deny'; this failed-but-permitted request is correctly 'allow' + result 'failure'.
    logChymeAudit({
      pluginId: 'chyme',
      command: 'account.profile.delete.full',
      actorId: OPERATOR_ACTOR_ID,
      status: 'allow',
      reason: 'operator_account_deletion',
      target: { scope: 'account', userId, schema: targetLabel, step },
      result: 'failure',
      errorCategory: 'persistence_error',
    });
    // Surface the failing step and the underlying error so the operator can diagnose from the run
    // log. This route is secret-gated and operator-only; the message is a DB/runtime error string
    // (no secrets), not a stack trace.
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, code: 'account_delete_failed', step, message: `Unable to complete operator account deletion: ${failureReason(error)}`, detail },
      { status: 503 },
    );
  }
}
