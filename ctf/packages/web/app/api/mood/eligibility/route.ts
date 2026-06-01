import { NextRequest, NextResponse } from 'next/server';
import { requireMoodAccess, moodErrorResponse } from 'lib/mood/_lib';
import { getMoodEligibility } from 'lib/mood/repository';
import { reportError } from 'lib/observability/report';

export async function GET(request: NextRequest) {
  const gate = await requireMoodAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const clientId = request.nextUrl.searchParams.get('clientId')?.trim() ?? '';
  if (!clientId) {
    return NextResponse.json({ ok: false, code: 'mood_client_id_required', message: 'clientId query parameter is required.' }, { status: 400 });
  }

  try {
    const eligibility = await getMoodEligibility({ clientId });
    return NextResponse.json({ ok: true, ...eligibility }, { status: 200 });
  } catch (error) {
    if (!(error instanceof Error && error.message === 'eligibility_not_found')) {
      reportError(error, { area: 'mood', op: 'get_eligibility', extra: { userId: gate.auth.userId, clientId } });
    }
    return moodErrorResponse(error, 'Mood eligibility unavailable.');
  }
}
