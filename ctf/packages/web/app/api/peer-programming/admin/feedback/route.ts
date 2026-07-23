import { NextResponse } from 'next/server';
import { peerProgrammingErrorResponse, requirePeerProgrammingAdminAccess } from 'lib/peer-programming/_lib';
import { listRecentFeedback } from 'lib/peer-programming/repository';
import { reportError } from 'lib/observability/report';

// Admin-only: the member feedback inbox, newest first. Read-only. There is no status column on this
// table, so this is an inbox (not a resolvable queue); the admin landing "new to review" dot for
// PeerProgramming is driven by feedback that arrived since the admin last opened this area.
export async function GET() {
  const gate = await requirePeerProgrammingAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const feedback = await listRecentFeedback(50);
    return NextResponse.json({ ok: true, feedback });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'admin-feedback' });
    return peerProgrammingErrorResponse(error, 'PeerProgramming feedback unavailable.');
  }
}
