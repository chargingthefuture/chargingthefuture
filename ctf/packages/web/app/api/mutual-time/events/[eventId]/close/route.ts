import { NextResponse } from 'next/server';
import { MUTUAL_TIME_ERROR_CODE } from 'lib/mutual-time/constants';
import { closeEvent } from 'lib/mutual-time/repository';
import { logMutualTimeAudit } from 'lib/mutual-time/audit';
import { reportError } from 'lib/observability/report';
import { requireMutualTimeAdmin, ensureMutationCsrf, mutualTimeErrorResponse } from '../../../_lib';

// POST /api/mutual-time/events/[eventId]/close — close a survey now and compute the winning time.
// Admin-only; the repository also checks the actor is the event's creator.
export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }
  const gate = await requireMutualTimeAdmin();
  if (!gate.allowed) {
    return gate.response;
  }

  const { eventId } = await context.params;
  try {
    const event = await closeEvent(gate.auth.userId, eventId);
    logMutualTimeAudit({
      pluginId: 'mutual-time',
      command: 'mutual-time.event.close',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'admin',
      target: { eventId: event.id, slug: event.slug, resultSlotStart: event.resultSlotStartIso },
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, event }, { status: 200 });
  } catch (error) {
    const mapped = mutualTimeErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    reportError(error, { area: 'mutual-time', op: 'event_close', extra: { userId: gate.auth.userId, eventId } });
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.internalError, message: 'Unable to close the event.' },
      { status: 500 },
    );
  }
}
