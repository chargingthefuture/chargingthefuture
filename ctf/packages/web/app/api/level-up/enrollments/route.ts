import { NextResponse } from 'next/server';
import { listMemberEnrollments } from 'lib/level-up/repository';
import { levelUpErrorResponse, requireLevelUpReadAccess } from 'lib/level-up/_lib';
import { reportError } from 'lib/observability/report';

// The signed-in member's own cohort enrollments. Scoped to the caller by user id inside the
// repository read — there is no way to ask for anyone else's, and no id is accepted from the request.
// Read-only: it moves no ServiceCredits and changes no row.
export async function GET() {
  const gate = await requireLevelUpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const enrollments = await listMemberEnrollments(gate.auth.userId);
    return NextResponse.json({ ok: true, enrollments });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'enrollments' });
    return levelUpErrorResponse(error, 'Your enrollments are unavailable.');
  }
}
