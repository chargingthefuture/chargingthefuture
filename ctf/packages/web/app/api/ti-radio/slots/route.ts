import { NextResponse } from 'next/server';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { TI_RADIO_ERROR_CODE } from 'lib/ti-radio/constants';
import { ensureMutationCsrf, requireTiRadioHost, tiRadioErrorResponse } from 'lib/ti-radio/_lib';
import { recordTiRadioAudit } from 'lib/ti-radio/audit';
import { bookSlot } from 'lib/ti-radio/repository';

export const dynamic = 'force-dynamic';

// POST /api/ti-radio/slots — claim an empty 90 minutes and become its host.
//
// Signed in and approved in Unlock, which is the app's default gate. Booking puts a member's name on
// a public schedule and commits them to turning up, so unlike writing a comment it is not a route
// into verification; it is something you do once you are in.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }
  const gate = await requireTiRadioHost();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: TI_RADIO_ERROR_CODE.invalidPayload,
        message: 'Invalid request body.',
        reason: failureReason(error),
      },
      { status: 400 },
    );
  }

  try {
    const booking = await bookSlot(
      { userId: gate.auth.userId, username: gate.auth.username },
      { slotStart: body.slotStart, title: body.title, description: body.description },
    );
    await recordTiRadioAudit({
      pluginId: 'ti-radio',
      command: 'ti-radio.slot.book',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_member',
      evidence: 'unlockTier=approved_full',
      target: { slotId: booking.id },
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, booking }, { status: 200 });
  } catch (error) {
    const mapped = tiRadioErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    reportError(error, { area: 'ti-radio', op: 'slot_book', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      {
        ok: false,
        code: TI_RADIO_ERROR_CODE.internalError,
        message: 'Unable to book that slot.',
        reason: failureReason(error),
      },
      { status: 500 },
    );
  }
}
