import { NextResponse } from 'next/server';
import { requireWorkforceReadAccess } from 'lib/workforce/_lib';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import { getOwnProfile } from 'lib/workforce/repository';
import { reportError } from 'lib/observability/report';

// Read-only. The workforce profile is a live view of the member's own claimed Directory profile
// (occupation = job title, skill level derived, recruited = claimed). Workforce no longer stores or
// edits its own profile — Directory + Skills Taxonomy are the single source of truth — so there is
// no create/update/delete here.
export async function GET() {
  const gate = await requireWorkforceReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const profile = await getOwnProfile(gate.auth.userId);
    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'workforce', op: 'profile' });
    return NextResponse.json(
      { ok: false, code: WORKFORCE_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch profile.' },
      { status: 503 },
    );
  }
}
