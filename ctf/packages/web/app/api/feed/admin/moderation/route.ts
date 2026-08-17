import { NextResponse } from 'next/server';
import { requireFeedAdminAccess } from '../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { countHiddenCommonsRows, listCommonsAuthors, listCommonsModerationQueue } from 'lib/feed/moderation';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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
  const authorUserId = url.searchParams.get('author');
  const limitParam = Number(url.searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(limitParam) ? limitParam : 50;

  try {
    // `authors` is the by-volume roster, returned alongside the rows so the surface can offer both
    // views from one request. Skipped when narrowing to a single author — the roster is what you use
    // to *pick* someone, so it is dead weight once you have.
    const [rows, hidden, authors] = await Promise.all([
      listCommonsModerationQueue({ limit, onlyHidden, authorUserId }),
      countHiddenCommonsRows(),
      authorUserId ? Promise.resolve([]) : listCommonsAuthors(50),
    ]);

    return NextResponse.json({ ok: true, rows, hidden, authors }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_moderation_list' });
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.persistenceUnavailable,
        message: `Could not load the moderation queue: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
