import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { buildToday } from 'lib/today/build';
import { reportError } from 'lib/observability/report';

// GET /api/today: everything the 3.1 Today screen draws, in one answer. Open to every signed-in
// member, approved or not, and after the 14 days (SOCIAL_REDESIGN_3_1_PLAN, Access: reading stays
// open). A source that fails is left out and named in `unavailable`; only a failure of the entire
// read answers 503.

export const dynamic = 'force-dynamic';

export async function GET() {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'signed_in' });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  try {
    const today = await buildToday({ userId: decision.userId, isAdmin: decision.isAdmin });
    return NextResponse.json({ ok: true, today }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    reportError(error, { area: 'today', op: 'build' });
    return NextResponse.json(
      { ok: false, code: 'TODAY_UNAVAILABLE', message: 'Could not read Today: building the list of cards failed.' },
      { status: 503 },
    );
  }
}
