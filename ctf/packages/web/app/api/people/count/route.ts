import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { countPeople } from 'lib/people/repository';
import { reportError } from 'lib/observability/report';

// GET /api/people/count: how many people the Directory lists, and nothing else (no name, id, skill or
// place). It is the number on People's header and on the screen a member not yet approved sees
// (approved board "People, not yet verified"), so it answers any signed-in member at 'signed_in';
// account restrictions still apply. The list itself, GET /api/people, stays approved-only.

export const dynamic = 'force-dynamic';

export async function GET() {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'signed_in' });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }
  try {
    const listed = await countPeople();
    return NextResponse.json({ ok: true, listed }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    reportError(error, { area: 'people', op: 'count' });
    return NextResponse.json(
      { ok: false, code: 'PEOPLE_UNAVAILABLE', message: 'Could not count People: the Directory read failed.' },
      { status: 503 },
    );
  }
}
