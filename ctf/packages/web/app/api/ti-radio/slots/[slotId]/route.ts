import { NextResponse } from 'next/server';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { TI_RADIO_ERROR_CODE } from 'lib/ti-radio/constants';
import { ensureMutationCsrf, requireTiRadioHost, tiRadioErrorResponse } from 'lib/ti-radio/_lib';
import { recordTiRadioAudit } from 'lib/ti-radio/audit';
import { releaseSlot } from 'lib/ti-radio/repository';

export const dynamic = 'force-dynamic';

// DELETE /api/ti-radio/slots/[slotId] — the host gives their own slot back.
//
// The inverse of booking, and not optional: a schedule you cannot get off is a trap, and somebody
// who cannot make a time they claimed should be able to hand it back rather than leave the guide
// advertising a discussion that will not happen. The row is kept and marked released, so the slot
// returns to the guide as empty and the record of who held it survives.
//
// An admin taking somebody else's slot down is a different action with a different gate; it lives in
// ./remove.
export async function DELETE(request: Request, context: { params: Promise<{ slotId: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }
  const gate = await requireTiRadioHost();
  if (!gate.allowed) {
    return gate.response;
  }
  const { slotId } = await context.params;

  try {
    const released = await releaseSlot({ userId: gate.auth.userId }, slotId);
    await recordTiRadioAudit({
      pluginId: 'ti-radio',
      command: 'ti-radio.slot.release',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'slot_host',
      evidence: 'owner=true',
      target: { slotId },
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, slotStartIso: released.slotStartIso }, { status: 200 });
  } catch (error) {
    const mapped = tiRadioErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    reportError(error, { area: 'ti-radio', op: 'slot_release', extra: { userId: gate.auth.userId, slotId } });
    return NextResponse.json(
      {
        ok: false,
        code: TI_RADIO_ERROR_CODE.internalError,
        message: 'Unable to release that slot.',
        reason: failureReason(error),
      },
      { status: 500 },
    );
  }
}
