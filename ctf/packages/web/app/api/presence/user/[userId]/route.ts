import { NextResponse } from 'next/server';
import { requireTrustMemberAccess } from 'lib/trust/_lib';
import { getMemberPresence } from 'lib/presence/repository';
import { reportError } from 'lib/observability/report';

// A member id is either a Clerk id (`user_…`) or a UUID; both fit this safe character set. The bound
// keeps an arbitrary probe string from reaching the query at all.
const MEMBER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// GET /api/presence/user/[userId]
// Returns the cross-plugin presence list for one member: where else they are active, each with a
// deep link into that plugin. Auth-gated to any signed-in member: this is a deliberate decision —
// nothing is public in this app, so any listing a member has counts as presence and there is no
// per-entry visibility gate, so any signed-in member may look up any member. Read-only.
export async function GET(_req: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId: targetUserId } = await context.params;

  const gate = await requireTrustMemberAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  if (!targetUserId || targetUserId.trim().length === 0) {
    return NextResponse.json({ error: 'Missing userId param' }, { status: 400 });
  }

  // Reject an id that cannot be a real member id before touching the database. Return the same empty
  // list the query would, so a malformed id gives no signal about the table's existence or contents.
  if (!MEMBER_ID_PATTERN.test(targetUserId)) {
    return NextResponse.json({ presence: [] }, { status: 200 });
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
