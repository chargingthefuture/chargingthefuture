import { NextResponse } from 'next/server';
import { peerProgrammingErrorResponse, requirePeerProgrammingAdminAccess } from 'lib/peer-programming/_lib';
import { listManagedCohorts } from 'lib/peer-programming/repository';
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
    return NextResponse.json({ ok: true, cohorts });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'admin-cohorts' });
    return peerProgrammingErrorResponse(error, 'Peer programming cohorts unavailable.');
  }
}
