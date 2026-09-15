import { NextResponse } from 'next/server';
import { requireFiresideAdmin } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import { countAllComments, listRecentComments } from 'lib/fireside/repository';
import { failureResponse } from 'lib/errors/failure';

const PAGE_SIZE = 20;

/**
 * Every comment, newest first, for an admin to work through.
 *
 * The export queue answers one question — may this go on the blog — and it is the only admin screen
 * there was. Removing or restoring a comment outside a thread meant knowing its id and calling the
 * route by hand, which is not a thing anybody does at the moment they need to.
 *
 * Removed and withdrawn rows are listed alongside live ones on purpose. An admin list that hides
 * what was already acted on cannot be used to undo anything, and undoing is most of what a
 * moderation list is for.
 */
export async function GET(request: Request) {
  const gate = await requireFiresideAdmin();
  if (!gate.allowed) return gate.response;

  const url = new URL(request.url);
  const requested = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(requested) && requested > 0 ? requested : 1;

  try {
    const total = await countAllComments();
    // Paged, never an endless list — accessibility rule. An out-of-range page clamps to the last
    // one rather than showing nothing, so a linked page number still renders after the list shrinks.
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, lastPage);
    const comments = await listRecentComments(PAGE_SIZE, (safePage - 1) * PAGE_SIZE);
    return NextResponse.json({ ok: true, comments, page: safePage, lastPage, total }, { status: 200 });
  } catch (error) {
    return failureResponse({
      summary: 'Unable to load recent comments',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'admin_comments_list',
      status: 503,
      audience: 'operator',
    });
  }
}
