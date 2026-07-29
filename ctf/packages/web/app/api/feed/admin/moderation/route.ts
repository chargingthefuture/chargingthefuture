import { NextResponse } from 'next/server';
import { requireFeedAdminAccess } from '../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { countHiddenCommonsRows, listCommonsModerationQueue } from 'lib/feed/moderation';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

// GET: the Commons moderation queue — recent posts and replies, with the hidden counts.
//
// Read-only and admin-gated. Hidden rows are included by default on purpose: a moderator has to be
// able to see what has been taken down in order to put it back, and a queue that only showed visible
// content would make hiding a one-way door in practice. `?hidden=1` narrows to exactly that review.
export async function GET(request: Request) {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const url = new URL(request.url);
  const onlyHidden = url.searchParams.get('hidden') === '1';
  const limitParam = Number(url.searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(limitParam) ? limitParam : 50;

  try {
    const [rows, hidden] = await Promise.all([
      listCommonsModerationQueue({ limit, onlyHidden }),
      countHiddenCommonsRows(),
    ]);

    return NextResponse.json({ ok: true, rows, hidden }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_moderation_list' });
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.persistenceUnavailable,
        message: 'Could not load the moderation queue.',
      },
      { status: 503 },
    );
  }
}
