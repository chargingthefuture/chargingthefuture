import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { ensureFeedAdmin } from 'lib/feed/policy';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { recordFeedAdminAudit } from 'lib/feed/audit';

export type FeedApiGate =
  | {
    allowed: true;
    auth: AllowDecision;
  }
  | {
    allowed: false;
    response: NextResponse;
  };

export async function requireFeedReadAccess(): Promise<FeedApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  return {
    allowed: true,
    auth: decision,
  };
}

export async function requireFeedAdminAccess(): Promise<FeedApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  const denyDecision = ensureFeedAdmin(decision);
  if (denyDecision) {
    return {
      allowed: false,
      response: NextResponse.json(denyDecision, { status: denyDecision.status }),
    };
  }

  return {
    allowed: true,
    auth: decision,
  };
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  const csrfHeader = request.headers.get('x-ctf-csrf');
  if (csrfHeader !== '1') {
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.csrfDenied,
        message: 'Missing CSRF confirmation header.',
      },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.csrfDenied,
        message: 'Invalid request origin metadata.',
      },
      { status: 403 },
    );
  }

  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.csrfDenied,
        message: 'Cross-origin mutation denied by CSRF policy.',
      },
      { status: 403 },
    );
  }

  return null;
}

// What an admin mutation is about, for its audit row: the command and the record it targets.
export type FeedAdminAuditTarget = {
  command: string;
  targetType: string;
  targetId: string;
};

// The audit contract records every admin mutation on every outcome, a refusal included. Writes the
// row for an admin action that did not go through. `errorCategory` is one of the codes the Audit log
// panel explains (policy, invalid_payload, not_found, persistence_error).
export async function recordFeedAdminFailure(
  actorId: string,
  target: FeedAdminAuditTarget,
  outcome: { status: 'allow' | 'deny'; reason: string; errorCategory: string },
): Promise<void> {
  await recordFeedAdminAudit({
    actorId,
    pluginId: 'feed',
    command: target.command,
    status: outcome.status,
    reason: outcome.reason,
    targetType: target.targetType,
    targetId: target.targetId,
    result: 'failure',
    errorCategory: outcome.errorCategory,
  });
}

// Admin gate plus CSRF check for a mutation route, with each refusal written to the audit trail. A
// caller who is not signed in and approved has no admin action to record, so that refusal returns
// without a row; a signed-in member who is not an admin, and a request that fails the CSRF check,
// are both recorded as a deny.
export async function requireFeedAdminMutation(request: Request, target: FeedAdminAuditTarget): Promise<FeedApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  const denyDecision = ensureFeedAdmin(decision);
  if (denyDecision) {
    await recordFeedAdminFailure(decision.userId, target, { status: 'deny', reason: 'not_admin', errorCategory: 'policy' });
    return {
      allowed: false,
      response: NextResponse.json(denyDecision, { status: denyDecision.status }),
    };
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    await recordFeedAdminFailure(decision.userId, target, { status: 'deny', reason: 'csrf_denied', errorCategory: 'policy' });
    return { allowed: false, response: csrfDeny };
  }

  return {
    allowed: true,
    auth: decision,
  };
}
