import { NextResponse } from 'next/server';
import { peerProgrammingErrorResponse, requirePeerProgrammingAdminAccess } from 'lib/peer-programming/_lib';
import { listActiveCohorts } from 'lib/peer-programming/repository';
import { reportError } from 'lib/observability/report';

// Admin-only: every cohort for the current week so an admin can see and reach each one after it
// forms. The member-scoped room endpoint only returns the admin's own cohort; this returns all of
// them with live member counts.
export async function GET() {
  const gate = await requirePeerProgrammingAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const cohorts = await listActiveCohorts();
    return NextResponse.json({ ok: true, cohorts });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'admin-cohorts' });
    return peerProgrammingErrorResponse(error, 'Peer programming cohorts unavailable.');
  }
}
