import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustAdminAccess, resolveRequestId, trustErrorResponse } from 'lib/trust/_lib';
import { TRUST_ERROR_CODE } from 'lib/trust/constants';
import { applyTrustAdminVerification } from 'lib/trust/repository';
import { logTrustAuditEvent } from 'lib/trust/audit';
import { TRUST_ADMIN_STATUS_VALUES, type TrustStatus } from 'lib/trust/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

function parseAdminStatus(value: unknown): TrustStatus | null {
  if (typeof value !== 'string') {
    return null;
  }
  return (TRUST_ADMIN_STATUS_VALUES as readonly string[]).includes(value)
    ? (value as TrustStatus)
    : null;
}

type VerificationPayload = { targetUserId: string; trustStatus: TrustStatus; note: string };

// Validate the decision body; returns the parsed payload or the 400 to send back.
function parseVerificationPayload(body: Record<string, unknown>): VerificationPayload | NextResponse {
  const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';
  if (!targetUserId) {
    return NextResponse.json(
      { ok: false, code: TRUST_ERROR_CODE.invalidPayload, message: 'targetUserId is required.' },
      { status: 400 },
    );
  }

  const trustStatus = parseAdminStatus(body.trustStatus);
  if (!trustStatus) {
    return NextResponse.json(
      {
        ok: false,
        code: TRUST_ERROR_CODE.invalidPayload,
        message: `trustStatus must be one of: ${TRUST_ADMIN_STATUS_VALUES.join(', ')}.`,
      },
      { status: 400 },
    );
  }

  const note = typeof body.note === 'string' ? body.note.trim() : '';
  return { targetUserId, trustStatus, note };
}

// POST /api/trust/admin/verification
// Admin-only review decision (contract: trust.admin.verification.review). Sets the target user's
// trust status to verified or flagged and appends one admin evidence item recording the decision.
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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: TRUST_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const payload = parseVerificationPayload(body);
  if (payload instanceof NextResponse) {
    return payload;
  }
  const { targetUserId, trustStatus, note } = payload;

  const requestId = resolveRequestId(request);
  const reviewerUserId = gate.auth.userId;

  try {
    const extension = await applyTrustAdminVerification({
      targetUserId,
      status: trustStatus,
      actorUserId: reviewerUserId,
      ...(note ? { note } : {}),
    });
    await logTrustAuditEvent({
      actorUserId: reviewerUserId,
      targetUserId,
      command: 'trust.admin.verification.review',
      policyStatus: 'allow',
      reason: 'admin_verification_review',
      requestId,
      metadata: { trustStatus, ...(note ? { note } : {}) },
    });
    return NextResponse.json(
      {
        ok: true,
        userId: extension.userId,
        trustStatus: extension.trustStatus,
        trustEvidence: extension.trustEvidence,
        updatedAt: extension.updatedAt,
        reviewedByUserId: reviewerUserId,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'trust', op: 'admin_verification_review' });
    return trustErrorResponse('Trust verification review unavailable.');
  }
}
