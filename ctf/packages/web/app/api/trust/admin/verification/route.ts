import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustAdminAccess, resolveRequestId, trustErrorResponse } from 'lib/trust/_lib';
import { TRUST_ERROR_CODE } from 'lib/trust/constants';
import { applyTrustAdminVerification } from 'lib/trust/repository';
import { logTrustAuditEvent } from 'lib/trust/audit';
import { TRUST_ADMIN_STATUS_VALUES, type TrustStatus } from 'lib/trust/types';
import { reportError } from 'lib/observability/report';

function parseStatus(value: unknown): TrustStatus | null {
  if (typeof value !== 'string') {
    return null;
  }
  return (TRUST_ADMIN_STATUS_VALUES as readonly string[]).includes(value)
    ? (value as TrustStatus)
    : null;
}

// POST /api/trust/admin/verification
// ADMIN-ONLY. Set a target user's trust status to `verified` or `flagged`, append an admin evidence
// note, and write an audit row.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: TRUST_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const targetUserIdRaw = body.targetUserId ?? body.subjectUserId;
  const targetUserId = typeof targetUserIdRaw === 'string' ? targetUserIdRaw.trim() : '';
  if (!targetUserId) {
    return NextResponse.json(
      { ok: false, code: TRUST_ERROR_CODE.invalidPayload, message: 'targetUserId is required.' },
      { status: 400 },
    );
  }

  const status = parseStatus(body.trustStatus ?? body.verificationStatus);
  if (!status) {
    return NextResponse.json(
      {
        ok: false,
        code: TRUST_ERROR_CODE.invalidPayload,
        message: `trustStatus must be one of: ${TRUST_ADMIN_STATUS_VALUES.join(', ')}.`,
      },
      { status: 400 },
    );
  }

  const note = typeof body.note === 'string' ? body.note : undefined;
  const requestId = resolveRequestId(request);
  const actorUserId = gate.auth.userId;

  try {
    const extension = await applyTrustAdminVerification({ targetUserId, status, actorUserId, note });
    await logTrustAuditEvent({
      actorUserId,
      targetUserId,
      command: 'trust.admin.verification.review',
      policyStatus: 'allow',
      reason: `set_status_${status}`,
      requestId,
      metadata: { trustStatus: status, hasNote: Boolean(note && note.trim().length > 0) },
    });
    return NextResponse.json(
      {
        ok: true,
        userId: extension.userId,
        trustStatus: extension.trustStatus,
        trustEvidence: extension.trustEvidence,
        updatedAt: extension.updatedAt,
        reviewedByUserId: actorUserId,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'trust', op: 'admin_verification' });
    return trustErrorResponse('Trust verification update unavailable.');
  }
}
