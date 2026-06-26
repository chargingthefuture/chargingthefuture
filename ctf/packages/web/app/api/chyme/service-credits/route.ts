import { NextResponse } from 'next/server';
import { requireChymeAccess, ensureMutationCsrf } from '../_lib';
import { sendServiceCredits } from 'lib/chyme/repository';
import { CHYME_MAX_TIP_AMOUNT } from 'lib/chyme/constants';
import { reportError } from 'lib/observability/report';

export async function POST(request: Request) {
  const gate = await requireChymeAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: { toUserId: string; amount: number; message?: string; idempotencyKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.toUserId || typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0) {
    return NextResponse.json({ ok: false, message: 'Invalid payload.' }, { status: 400 });
  }

  // Reject a self-tip: round-tripping credits to yourself has no purpose and invites fee/accounting abuse.
  if (body.toUserId === gate.identity.userId) {
    return NextResponse.json({ ok: false, message: 'You cannot tip yourself.' }, { status: 400 });
  }

  // Cap the amount at the route so an unbounded value never reaches the transfer primitive.
  if (body.amount > CHYME_MAX_TIP_AMOUNT) {
    return NextResponse.json(
      { ok: false, message: `Amount exceeds the maximum tip of ${CHYME_MAX_TIP_AMOUNT}.` },
      { status: 400 },
    );
  }

  // A stable client-supplied nonce makes a retried tip idempotent; namespace it under the sender so one
  // member's nonce can never collide with another's. Absent a nonce the repository mints a per-request UUID.
  const clientNonce =
    typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
      ? body.idempotencyKey.trim()
      : null;
  const idempotencyKey = clientNonce ? `chyme-${gate.identity.userId}-${clientNonce}` : undefined;

  try {
    const tx = await sendServiceCredits(gate.identity.userId, body.toUserId, body.amount, body.message, idempotencyKey);
    return NextResponse.json({ ok: true, transaction: tx }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'service_credits' });
    return NextResponse.json({ ok: false, message: (error as Error).message }, { status: 500 });
  }
}
