import { NextResponse } from 'next/server';
import { requireFiresideAdmin } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import {
  countAllComments,
  countSearchComments,
  listRecentComments,
  searchComments,
} from 'lib/fireside/repository';
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
 *
 * `?q=` searches the comment bodies. Being searchable is one of the four reasons these live in
 * Postgres rather than in a chat product, and this is the first thing that reads that index. It is
 * deliberately an admin search rather than a member-facing one across every thread: that would be
 * the browse-every-conversation view, which the owner tabled on 2026-09-13.
 */
export async function GET(request: Request) {
  const gate = await requireFiresideAdmin();
  if (!gate.allowed) return gate.response;

  const url = new URL(request.url);
  const requested = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(requested) && requested > 0 ? requested : 1;
  // An empty or blank search is no search, not a search for nothing.
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 200);

  try {
    const total = query ? await countSearchComments(query) : await countAllComments();
    // Paged, never an endless list — accessibility rule. An out-of-range page clamps to the last
    // one rather than showing nothing, so a linked page number still renders after the list shrinks.
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, lastPage);
    const offset = (safePage - 1) * PAGE_SIZE;
    const comments = query
      ? await searchComments(query, PAGE_SIZE, offset)
      : await listRecentComments(PAGE_SIZE, offset);
    return NextResponse.json({ ok: true, comments, page: safePage, lastPage, total, query }, { status: 200 });
  } catch (error) {
    return failureResponse({
      summary: 'Unable to load recent comments',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'admin_comments_list',
      status: 503,
      audience: 'operator',
      extra: { query },
    });
  }
}
