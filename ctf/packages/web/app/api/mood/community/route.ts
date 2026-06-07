import { NextResponse } from 'next/server';
import { requireMoodAccess, moodErrorResponse } from 'lib/mood/_lib';
import { getMoodCommunityPulse } from 'lib/mood/repository';
import { reportError } from 'lib/observability/report';

// GET /api/mood/community — aggregate, anonymous community pulse for the Mood
// plugin. Returns only counts and averages over the trailing window; never any
// per-user rows, notes, or identifiers.
export async function GET() {
  const gate = await requireMoodAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const pulse = await getMoodCommunityPulse();
    return NextResponse.json({ ok: true, pulse }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'mood', op: 'community' });
    return moodErrorResponse(error, 'Community pulse unavailable.');
  }
}
