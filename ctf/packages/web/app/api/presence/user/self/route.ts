import { NextResponse } from 'next/server';
import { requireTrustMemberAccess } from 'lib/trust/_lib';
import { getMemberPresence } from 'lib/presence/repository';
import { refreshOwnPresence } from 'lib/presence/derive';
import { reportError } from 'lib/observability/report';

// GET /api/presence/user/self
// Re-derive the CALLER's cross-plugin presence from the live source tables, self-healing any index
// row that a best-effort write dropped or that predates the live write hooks, then return the active
// list. This is the presence counterpart of GET /api/trust/user/self, which recomputes the caller's
// trust signal on read. Auth-gated to any signed-in member; read-shaped (the recompute writes only
// the caller's own presence rows, idempotently).
export async function GET() {
  const gate = await requireTrustMemberAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const userId = gate.auth.userId;

  try {
    const presence = await refreshOwnPresence(userId);
    return NextResponse.json({ presence }, { status: 200 });
  } catch (error) {
    // A failed recompute must never break the member's own read: fall back to the last stored index
    // so the panel still renders whatever rows already exist.
    reportError(error, { area: 'presence', op: 'self_refresh' });
    try {
      const presence = await getMemberPresence(userId);
      return NextResponse.json({ presence }, { status: 200 });
    } catch (readError) {
      reportError(readError, { area: 'presence', op: 'self_read' });
      return NextResponse.json({ presence: [] }, { status: 200 });
    }
  }
}
