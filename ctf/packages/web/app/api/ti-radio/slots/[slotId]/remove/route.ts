import { NextResponse } from 'next/server';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { TI_RADIO_ERROR_CODE, TI_RADIO_MAX_REMOVAL_REASON_LENGTH } from 'lib/ti-radio/constants';
import { ensureMutationCsrf, requireTiRadioAdmin, tiRadioErrorResponse } from 'lib/ti-radio/_lib';
import { recordTiRadioAudit } from 'lib/ti-radio/audit';
import { removeSlot } from 'lib/ti-radio/repository';

export const dynamic = 'force-dynamic';

// POST /api/ti-radio/slots/[slotId]/remove — an admin takes a booked slot off the schedule.
//
// Separate from the host's own release so the two are never confused in the record: this one keeps
// who did it and why on the row and writes an audit line. The guide is public, so a discussion
// nobody should be pointed at has to be removable by somebody other than the person who put it
// there — and in an app with one admin, the record of having done it is what makes that safe.
export async function POST(request: Request, context: { params: Promise<{ slotId: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }
  const gate = await requireTiRadioAdmin();
  if (!gate.allowed) {
    return gate.response;
  }
  const { slotId } = await context.params;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rawReason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const reason = rawReason.length > 0 ? rawReason.slice(0, TI_RADIO_MAX_REMOVAL_REASON_LENGTH) : null;

  try {
    const removed = await removeSlot({ userId: gate.auth.userId }, slotId, reason);
    await recordTiRadioAudit({
      pluginId: 'ti-radio',
      command: 'ti-radio.slot.remove',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: reason ?? 'admin',
      evidence: 'role=admin',
      target: { slotId, hostUserId: removed.hostUserId },
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, slotStartIso: removed.slotStartIso }, { status: 200 });
  } catch (error) {
    const mapped = tiRadioErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    reportError(error, { area: 'ti-radio', op: 'slot_remove', extra: { userId: gate.auth.userId, slotId } });
    return NextResponse.json(
      {
        ok: false,
        code: TI_RADIO_ERROR_CODE.internalError,
        message: 'Unable to remove that slot.',
        reason: failureReason(error),
      },
      { status: 500 },
    );
  }
}
