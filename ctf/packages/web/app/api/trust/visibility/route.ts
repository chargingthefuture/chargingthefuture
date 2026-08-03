import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustMemberAccess, resolveRequestId, trustErrorResponse } from 'lib/trust/_lib';
import { TRUST_ERROR_CODE } from 'lib/trust/constants';
import { setTrustVisibility } from 'lib/trust/repository';
import { logTrustAuditEvent } from 'lib/trust/audit';
import { TRUST_VISIBILITY_VALUES, type TrustVisibility } from 'lib/trust/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

function parseVisibility(value: unknown): TrustVisibility | null {
  if (typeof value !== 'string') {
    return null;
  }
  return (TRUST_VISIBILITY_VALUES as readonly string[]).includes(value)
    ? (value as TrustVisibility)
    : null;
}

// POST /api/trust/visibility
// Update the caller's own trust visibility (public | private | restricted). Self-scope only.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustMemberAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: TRUST_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const visibility = parseVisibility(body.trustVisibility);
  if (!visibility) {
    return NextResponse.json(
      {
        ok: false,
        code: TRUST_ERROR_CODE.invalidPayload,
        message: `trustVisibility must be one of: ${TRUST_VISIBILITY_VALUES.join(', ')}.`,
      },
      { status: 400 },
    );
  }

  const requestId = resolveRequestId(request);
  const userId = gate.auth.userId;

  try {
    const extension = await setTrustVisibility(userId, visibility);
    await logTrustAuditEvent({
      actorUserId: userId,
      targetUserId: userId,
      command: 'trust.visibility.update',
      policyStatus: 'allow',
      reason: 'self_visibility_update',
      requestId,
      metadata: { trustVisibility: visibility },
    });
    return NextResponse.json(
      {
        ok: true,
        userId: extension.userId,
        trustVisibility: extension.trustVisibility,
        updatedAt: extension.updatedAt,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'trust', op: 'visibility_update' });
    return trustErrorResponse('Trust visibility update unavailable.');
  }
}
