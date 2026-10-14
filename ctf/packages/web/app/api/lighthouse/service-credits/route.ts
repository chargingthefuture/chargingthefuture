import { NextResponse } from 'next/server';
import { requireLighthouseReadAccess, ensureMutationCsrf } from 'lib/lighthouse/_lib';
import { createTransfer } from 'lib/service-credits/repository';
import { knownServiceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { LIGHTHOUSE_ERROR_CODE } from 'lib/lighthouse/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type LighthouseServiceCreditsSendInput = {
  toUserId: string;
  amount: number;
  message?: string;
  idempotencyKey?: string;
};

// Reads and checks the body. Returns the send to make, or the 400 to answer.
async function parseSendRequest(
  request: Request,
): Promise<{ error: NextResponse } | { input: LighthouseServiceCreditsSendInput; idempotencyKey: string }> {
  let input: LighthouseServiceCreditsSendInput;
  try {
    input = await request.json();
  } catch (error) {
    return { error: NextResponse.json({ ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid JSON.', reason: failureReason(error) }, { status: 400 }) };
  }

  if (!input.toUserId || typeof input.amount !== 'number' || input.amount <= 0) {
    return { error: NextResponse.json({ ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'Invalid payload.' }, { status: 400 }) };
  }

  // Required, as on the shared POST /api/service-credits/transfers. A key made up here would differ on
  // every retry, so createTransfer could never recognize a repeat and the credits would move twice.
  const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
  if (idempotencyKey.length === 0) {
    return {
      error: NextResponse.json(
        { ok: false, code: LIGHTHOUSE_ERROR_CODE.invalidPayload, message: 'idempotencyKey is required, so a retried send is not sent twice.' },
        { status: 400 },
      ),
    };
  }

  return { input, idempotencyKey };
}

export async function POST(request: Request) {
  // CSRF gate runs first, matching every other mutation handler in this plugin, so a cross-origin
  // request is rejected before any authenticated DB lookup.
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const parsed = await parseSendRequest(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const { input, idempotencyKey } = parsed;

  try {
    const tx = await createTransfer({
      senderUserId: gate.auth.userId,
      recipientUserId: input.toUserId,
      amount: input.amount,
      idempotencyKey,
      originPlugin: 'lighthouse',
      reasonCode: 'lighthouse.transfer',
    });

    return NextResponse.json({ ok: true, transaction: tx }, { status: 200 });
  } catch (error) {
    // A known refusal (not enough credits, a restricted or frozen sender) is answered as such, so the
    // member is not told to try again when trying again cannot work.
    const known = knownServiceCreditsErrorResponse(error);
    if (known) {
      return known;
    }
    reportError(error, { area: 'lighthouse', op: 'service_credits' });
    return NextResponse.json({ ok: false, code: LIGHTHOUSE_ERROR_CODE.persistenceUnavailable, message: 'Unable to send ServiceCredits.' }, { status: 503 });
  }
}
