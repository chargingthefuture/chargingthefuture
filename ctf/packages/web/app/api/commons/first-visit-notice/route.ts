import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import {
  firstVisitNotice,
  hasSeenFirstVisitNotice,
  markFirstVisitNoticeSeen,
} from 'lib/feed/commons-guidance';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

// The one notice a member is shown on arrival rather than waiting for the rotation.
//
// Why this exists alongside the cadence: the public-rooms notice is the only one where hearing it late
// has a real cost. A member who does not know the Commons is readable by anyone — including people with
// no account — can post something identifying before their first cadence hit arrives. The rotation
// cannot fix that; only showing it once, up front, can.
//
// Gated at `any_authenticated` rather than full unlock, deliberately: a member who has signed in but not
// yet verified can already read and post in the Commons, so they are exactly who needs to be told first.

// GET: should this member be shown it?
export async function GET() {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'any_authenticated' });
  if (!decision.allowed) {
    // Signed-out visitors are not tracked and are not shown it — they cannot post, so there is nothing
    // for them to disclose yet.
    return NextResponse.json({ ok: true, show: false }, { status: 200 });
  }

  try {
    const notice = firstVisitNotice();
    if (!notice) {
      return NextResponse.json({ ok: true, show: false }, { status: 200 });
    }

    const seen = await hasSeenFirstVisitNotice(decision.userId);
    return NextResponse.json(
      { ok: true, show: !seen, title: notice.title, body: notice.body },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'feed', op: 'first_visit_notice_read' });
    // Fail closed: show nothing rather than risk showing it on every visit.
    return NextResponse.json({ ok: true, show: false }, { status: 200 });
  }
}

// POST: the member has read it. Idempotent.
export async function POST(request: Request) {
  const decision = await evaluatePluginAccess({ requireUsername: false, minUnlockTier: 'any_authenticated' });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  // Returns a verdict string, not a boolean — comparing against 'allow' rather than truthiness, because
  // every one of its values is truthy and a `!` test here would disable the check entirely.
  if (checkMutationOrigin(request) !== 'allow') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.csrfDenied, message: 'Request origin not allowed.' },
      { status: 403 },
    );
  }

  await markFirstVisitNoticeSeen(decision.userId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
