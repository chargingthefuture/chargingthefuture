import { NextResponse } from 'next/server';
import { peerProgrammingErrorResponse, requirePeerProgrammingAdminAccess } from 'lib/peer-programming/_lib';
import { listManagedCohorts } from 'lib/peer-programming/repository';
import { buildCohortRosters } from 'lib/peer-programming/roster';
import { reportError } from 'lib/observability/report';

// Admin-only: every cohort across recent weeks (most recent first) so an admin can see and reach each
// one they formed, even after the week rolls over. The member-scoped room endpoint only returns the
// admin's own cohort; this returns all of them with live member counts.
export async function GET() {
  const gate = await requirePeerProgrammingAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const cohorts = await listManagedCohorts();
    // Attach each cohort's member roster (resolved usernames) so an admin can see who is assigned,
    // not just a count. Membership is not secret. One Clerk lookup covers every listed cohort.
    const rosters = await buildCohortRosters(cohorts.map((cohort) => cohort.id));
    const cohortsWithMembers = cohorts.map((cohort) => ({
      ...cohort,
      members: rosters.get(cohort.id) ?? [],
    }));
    return NextResponse.json({ ok: true, cohorts: cohortsWithMembers });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'admin-cohorts' });
    return peerProgrammingErrorResponse(error, 'Peer programming cohorts unavailable.');
  }
}
