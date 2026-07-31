import { NextResponse } from 'next/server';
import { requireFeedAdminAccess } from '../../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { countPendingFlaggedAnswers, listFlaggedAnswers } from 'lib/feed/moderation';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

// GET: answers members have flagged, most-flagged first.
//
// This closes a gap that existed for as long as flagging did. A member could rate an answer `flagged`,
// the count was aggregated by `GET /api/feed/admin/questions` — and no page ever called that route, so
// the flag reached nobody. The signal was being collected and discarded.
//
// Ordered by flag count rather than date because this is a triage queue: the answer six people objected
// to matters more than the one that arrived most recently. Hidden answers are included so a moderator
// can see and reverse their own calls.
export async function GET(request: Request) {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  // `Number('')` is 0 and negative numbers are finite, so a bare or negative `limit` param must
  // fall back to the intended default of 50 rather than slipping through (issue #2018). Matches
  // the moderation-queue route's pattern; listFlaggedAnswers still clamps the upper bound.
  const limitParam = Number(new URL(request.url).searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;

  try {
    const [answers, pending] = await Promise.all([
      listFlaggedAnswers(limit),
      countPendingFlaggedAnswers(),
    ]);

    return NextResponse.json({ ok: true, answers, pending }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_flagged_answers' });
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.persistenceUnavailable,
        message: 'Could not load flagged answers.',
      },
      { status: 503 },
    );
  }
}
