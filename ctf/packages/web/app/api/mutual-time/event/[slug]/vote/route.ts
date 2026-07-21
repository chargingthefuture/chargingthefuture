import { NextResponse } from 'next/server';
import { MUTUAL_TIME_ERROR_CODE } from 'lib/mutual-time/constants';
import { saveVote } from 'lib/mutual-time/repository';
import { logMutualTimeAudit } from 'lib/mutual-time/audit';
import { reportError } from 'lib/observability/report';
import { requireMutualTimeVote, ensureMutationCsrf, mutualTimeErrorResponse } from '../../../_lib';

// POST /api/mutual-time/event/[slug]/vote  { slots: string[] }
// Save (replace) the signed-in, Unlock-approved member's picks for an event. Up to 3 half-hour-snapped
// one-hour windows. Rejected if the event is not currently open or a pick is not a valid candidate slot.
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }
  const gate = await requireMutualTimeVote();
  if (!gate.allowed) {
    return gate.response;
  }

  const { slug } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.invalidPayload, message: 'Invalid request body.' },
      { status: 400 },
    );
  }

  try {
    const picks = await saveVote(slug, gate.auth.userId, body.slots);
    logMutualTimeAudit({
      pluginId: 'mutual-time',
      command: 'mutual-time.vote.save',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_member',
      target: { slug, pickCount: String(picks.length) },
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, picks }, { status: 200 });
  } catch (error) {
    const mapped = mutualTimeErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    reportError(error, { area: 'mutual-time', op: 'vote_save', extra: { userId: gate.auth.userId, slug } });
    return NextResponse.json(
      { ok: false, code: MUTUAL_TIME_ERROR_CODE.internalError, message: 'Unable to save your picks.' },
      { status: 500 },
    );
  }
}
