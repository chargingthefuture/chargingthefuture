import { NextResponse } from 'next/server';
import { requireFoundationReadAccess, ensureMutationCsrf } from '../_lib';
import { createTransfer } from 'lib/service-credits/repository';
import { FOUNDATION_ERROR_CODE } from 'lib/foundation/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type FoundationServiceCreditsSendInput = {
  toUserId: string;
  amount: number;
  message?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const gate = await requireFoundationReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let input: FoundationServiceCreditsSendInput;
  try {
    input = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid JSON.', reason: failureReason(error) }, { status: 400 });
  }

  if (!input.toUserId || typeof input.amount !== 'number' || input.amount <= 0) {
    return NextResponse.json({ ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'Invalid payload.' }, { status: 400 });
  }

  // A ServiceCredits transfer must be idempotent on retry, so the caller must supply a stable
  // idempotencyKey (one per user action, reused across network retries). The previous fallback keyed on
  // Date.now(), which changed on every request, so a client retry created a DUPLICATE transfer instead of
  // replaying the first one — a money-safety gap (issue #1957). Require the key rather than invent one.
  const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
  if (idempotencyKey.length === 0) {
    return NextResponse.json(
      { ok: false, code: FOUNDATION_ERROR_CODE.invalidPayload, message: 'idempotencyKey is required.' },
      { status: 400 },
    );
  }

  try {
    const tx = await createTransfer({
      senderUserId: gate.auth.userId,
      recipientUserId: input.toUserId,
      amount: input.amount,
      idempotencyKey,
      originPlugin: 'foundation',
      reasonCode: 'foundation.transfer',
    });

    return NextResponse.json({ ok: true, transaction: tx }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'foundation', op: 'service_credits' });
    console.error('[Foundation] ServiceCredits transfer failed:', error);
    return NextResponse.json({ ok: false, code: FOUNDATION_ERROR_CODE.persistenceUnavailable, message: 'Unable to send ServiceCredits.' }, { status: 503 });
  }
}
