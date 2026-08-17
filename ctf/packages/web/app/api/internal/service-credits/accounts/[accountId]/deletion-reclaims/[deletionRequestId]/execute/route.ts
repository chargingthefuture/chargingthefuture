import { NextResponse } from 'next/server';
import { executeDeletionReclaim, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type ReclaimBody = {
  treasuryUserId?: string;
  requestedAt?: string;
  idempotencyKey?: string;
  requestId?: string;
  traceId?: string;
};

type ReclaimParams = {
  params: Promise<{ accountId: string; deletionRequestId: string }>;
};

// Correctness-only check: the caller has already confirmed the token is configured (the 503 guard in
// POST), so this only compares the supplied header against the known-non-empty token.
function isAuthorized(request: Request, configuredToken: string): boolean {
  const providedToken = request.headers.get('x-service-credits-internal-token') ?? '';
  return providedToken.length > 0 && providedToken === configuredToken;
}

// Presence + token gate. Distinguish "not configured" (503 — token missing in the app runtime) from
// "wrong/no token" (403) so the calling service can tell a misconfigured deployment from a bad
// credential, matching the account/delete route. This is the only presence check; isAuthorized only
// verifies the token. Returns a ready error response, or null when the caller is authorized.
function authorizeReclaimRequest(request: Request): NextResponse | null {
  const configuredToken = process.env.SERVICE_CREDITS_INTERNAL_TOKEN?.trim() ?? '';
  if (configuredToken.length === 0) {
    return NextResponse.json(
      { ok: false, code: 'service_credits_internal_not_configured', message: 'SERVICE_CREDITS_INTERNAL_TOKEN is not set in the app runtime.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request, configuredToken)) {
    return NextResponse.json(
      { ok: false, code: 'service_credits_invalid_internal_token', message: 'Invalid ServiceCredits internal token.' },
      { status: 403 },
    );
  }
  return null;
}

// The five fields required by executeDeletionReclaim, narrowed to non-optional strings once the
// payload guard has passed — mirrors the narrowing the inline `if (!body.x || ...)` guard produced.
type ValidatedReclaimBody = ReclaimBody & {
  treasuryUserId: string;
  requestedAt: string;
  idempotencyKey: string;
  requestId: string;
  traceId: string;
};

// Parse + validate the reclaim body. Returns a ready error response (invalid JSON, or a missing
// required field) or the validated body. Status codes and code strings are unchanged from the inline
// version.
async function parseReclaimBody(request: Request): Promise<{ error: NextResponse } | { data: ValidatedReclaimBody }> {
  let body: ReclaimBody;
  try {
    body = (await request.json()) as ReclaimBody;
  } catch (caught) {
    return { error: NextResponse.json({ ok: false, code: 'service_credits_invalid_json', message: 'Invalid JSON body.', reason: failureReason(caught) }, { status: 400 }) };
  }

  if (!body.treasuryUserId || !body.requestedAt || !body.idempotencyKey || !body.requestId || !body.traceId) {
    return {
      error: NextResponse.json(
        { ok: false, code: 'service_credits_invalid_payload', message: 'treasuryUserId, requestedAt, idempotencyKey, requestId, and traceId are required.' },
        { status: 400 },
      ),
    };
  }

  return {
    data: {
      treasuryUserId: body.treasuryUserId,
      requestedAt: body.requestedAt,
      idempotencyKey: body.idempotencyKey,
      requestId: body.requestId,
      traceId: body.traceId,
    },
  };
}

export async function POST(request: Request, context: ReclaimParams) {
  const authError = authorizeReclaimRequest(request);
  if (authError) {
    return authError;
  }

  const parsed = await parseReclaimBody(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const body = parsed.data;

  const { accountId, deletionRequestId } = await context.params;

  try {
    const reclaim = await executeDeletionReclaim({
      actorId: 'internal_service_credits_reclaimer',
      accountId,
      deletionRequestId,
      treasuryUserId: body.treasuryUserId,
      requestedAt: body.requestedAt,
      idempotencyKey: body.idempotencyKey,
      requestId: body.requestId,
      traceId: body.traceId,
    });

    await insertServiceCreditsAudit({
      actorId: 'internal_service_credits_reclaimer',
      command: 'service-credits.account.deletion.reclaim.execute',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'account_deletion_reclaim',
      targetId: `${accountId}:${deletionRequestId}`,
      metadata: {
        amountTransferred: reclaim.amountTransferred,
        transferId: reclaim.transferId,
        tombstoneId: reclaim.tombstoneId,
        requestId: body.requestId,
        traceId: body.traceId,
      },
    });

    return NextResponse.json({ ok: true, reclaim }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'internal', op: 'service_credits_accounts_accountid_deletion_reclaims_deletionrequestid_execute' });
    return serviceCreditsErrorResponse(error, 'Account deletion reclaim unavailable.');
  }
}
