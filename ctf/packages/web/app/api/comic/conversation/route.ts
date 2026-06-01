import { NextResponse } from 'next/server';
import { requireComicReadAccess } from '../_lib';
import { COMIC_ASKER_STREAM_LIMIT, COMIC_ERROR_CODE } from 'lib/comic/constants';
import { listComicAskerStream } from 'lib/comic/repository';
import { reportError } from 'lib/observability/report';

// Asker-facing read of the current user's own @comic Q&A history. Returns answered AI cards
// (approved/corrected only) and pending "Reviewing for safety" items. The repository enforces the
// invariant that an unreviewed draft is never surfaced here; this route is scoped to the caller's
// own conversations.
export async function GET(request: Request) {
  const gate = await requireComicReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number.parseInt(searchParams.get('limit') ?? '', 10);
  const limit = Number.isNaN(limitParam) ? COMIC_ASKER_STREAM_LIMIT : limitParam;

  try {
    const result = await listComicAskerStream(gate.auth.userId, limit);
    return NextResponse.json({ ok: true, items: result.items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'conversation' });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: 'Unable to load AI Assistant conversation.' },
      { status: 503 },
    );
  }
}
