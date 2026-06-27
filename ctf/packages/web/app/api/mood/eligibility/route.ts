import { NextRequest, NextResponse } from 'next/server';
import { requireMoodAccess, moodErrorResponse } from 'lib/mood/_lib';
import { getMoodEligibility, getOrCreateMoodPseudonym } from 'lib/mood/repository';
import { logMoodAudit } from 'lib/mood/audit';
import { reportError } from 'lib/observability/report';

export async function GET(request: NextRequest) {
  const gate = await requireMoodAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  // clientId stays required by contract (clientIdRequired), but the eligibility
  // lookup is keyed on the server-controlled pseudonym (resolved from the
  // authenticated user), not this value — a member can only ever read their own
  // cooldown state, and the lookup touches no user_id.
  const clientId = request.nextUrl.searchParams.get('clientId')?.trim() ?? '';
  if (!clientId) {
    logMoodAudit({
      actorId: gate.auth.userId,
      command: 'mood.check.eligibility.fetch',
      status: 'deny',
      reason: 'missing_client_id',
      evidence: { roleCheck: 'pass', clientIdCheck: 'fail' },
      dataClassesAccessed: ['mood_check_eligibility_metadata'],
      target: {},
      result: 'failure',
      errorCategory: 'missing_client_id',
    });
    return NextResponse.json({ ok: false, code: 'mood_client_id_required', message: 'clientId query parameter is required.' }, { status: 400 });
  }

  try {
    const pseudonym = await getOrCreateMoodPseudonym(gate.auth.userId);
    const eligibility = await getMoodEligibility({ pseudonym });
    logMoodAudit({
      actorId: gate.auth.userId,
      command: 'mood.check.eligibility.fetch',
      status: 'allow',
      reason: 'eligibility_evaluated',
      evidence: { roleCheck: 'pass', clientIdCheck: 'pass' },
      dataClassesAccessed: ['mood_check_eligibility_metadata'],
      target: { clientId },
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, ...eligibility }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'mood', op: 'eligibility' });
    logMoodAudit({
      actorId: gate.auth.userId,
      command: 'mood.check.eligibility.fetch',
      status: 'deny',
      reason: 'persistence_error',
      evidence: { roleCheck: 'pass', clientIdCheck: 'pass' },
      dataClassesAccessed: ['mood_check_eligibility_metadata'],
      target: { clientId },
      result: 'failure',
      errorCategory: 'persistence_error',
    });
    return moodErrorResponse(error, 'Mood eligibility unavailable.');
  }
}
