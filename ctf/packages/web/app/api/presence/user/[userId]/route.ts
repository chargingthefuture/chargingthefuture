import { NextResponse } from 'next/server';
import { requireTrustMemberAccess } from 'lib/trust/_lib';
import { getMemberPresence } from 'lib/presence/repository';
import { reportError } from 'lib/observability/report';

// GET /api/presence/user/[userId]
// Returns the cross-plugin presence list for one member: where else they are active, each with a
// deep link into that plugin. Auth-gated to any signed-in member (nothing is public in this app, so
// any listing a member has counts as presence; there is no per-entry visibility gate). Read-only.
export async function GET(_req: Request, context: unknown) {
  const { userId: targetUserId } = (context as { params: { userId: string } }).params;

  const gate = await requireTrustMemberAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const presence = await getMemberPresence(targetUserId);
    return NextResponse.json({ presence }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'presence', op: 'user_read' });
    // Presence is additive and never load-bearing for the profile, so a failure returns an empty
    // list rather than an error the caller has to handle.
    return NextResponse.json({ presence: [] }, { status: 200 });
  }
}
