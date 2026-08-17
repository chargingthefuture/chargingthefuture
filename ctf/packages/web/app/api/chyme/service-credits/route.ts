import { NextResponse } from 'next/server';
import { requireChymeAccess, ensureMutationCsrf } from '../_lib';
import { sendServiceCredits } from 'lib/chyme/repository';
import { CHYME_MAX_TIP_AMOUNT } from 'lib/chyme/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type TipBody = { toUserId: string; amount: number; message?: string; idempotencyKey?: unknown };

// A stable client-supplied nonce makes a retried tip idempotent; namespace it under the sender so one
// member's nonce can never collide with another's. Absent a nonce the repository mints a per-request UUID.
function buildTipIdempotencyKey(senderUserId: string, rawKey: unknown): string | undefined {
  const clientNonce =
    typeof rawKey === 'string' && rawKey.trim().length > 0 ? rawKey.trim() : null;
  return clientNonce ? `chyme-${senderUserId}-${clientNonce}` : undefined;
}

// Validate a parsed tip payload and derive the namespaced idempotency key. Pure (no I/O) so the route
// body stays under the complexity limit; every guard, message, and status code is unchanged from the
// inline version.
function validateTipRequest(
  body: TipBody,
  senderUserId: string,
): { error: NextResponse } | { data: { toUserId: string; amount: number; message?: string; idempotencyKey: string | undefined } } {
  if (!body.toUserId || typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0) {
    return { error: NextResponse.json({ ok: false, message: 'Invalid payload.' }, { status: 400 }) };
  }

  // Reject a self-tip: round-tripping credits to yourself has no purpose and invites fee/accounting abuse.
  if (body.toUserId === senderUserId) {
    return { error: NextResponse.json({ ok: false, message: 'You cannot tip yourself.' }, { status: 400 }) };
  }

  // Cap the amount at the route so an unbounded value never reaches the transfer primitive.
  if (body.amount > CHYME_MAX_TIP_AMOUNT) {
    return {
      error: NextResponse.json(
        { ok: false, message: `Amount exceeds the maximum tip of ${CHYME_MAX_TIP_AMOUNT}.` },
        { status: 400 },
      ),
    };
  }

  const idempotencyKey = buildTipIdempotencyKey(senderUserId, body.idempotencyKey);
  return { data: { toUserId: body.toUserId, amount: body.amount, message: body.message, idempotencyKey } };
}

export async function POST(request: Request) {
  const gate = await requireChymeAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: TipBody;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.', reason: failureReason(error) }, { status: 400 });
  }

  const validated = validateTipRequest(body, gate.identity.userId);
  if ('error' in validated) {
    return validated.error;
  }
  const { toUserId, amount, message, idempotencyKey } = validated.data;

  try {
    const tx = await sendServiceCredits(gate.identity.userId, toUserId, amount, message, idempotencyKey);
    return NextResponse.json({ ok: true, transaction: tx }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'service_credits' });
    return NextResponse.json({ ok: false, message: (error as Error).message }, { status: 500 });
  }
}
