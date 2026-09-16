import { NextResponse } from 'next/server';
import { requireFiresideAdmin } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import { countAllThreads, listAllThreads } from 'lib/fireside/repository';
import { failureResponse } from 'lib/errors/failure';

const PAGE_SIZE = 20;

/**
 * Every conversation, the one with the newest comment first.
 *
 * Closing a thread was reachable only from the post it belongs to, which means an admin had to
 * already know which post they wanted. This is the list that gives that power a screen.
 *
 * Closed threads and threads whose comments have all been taken out are listed alongside the rest,
 * counted rather than dropped: an admin list hides nothing, and a thread something was already done
 * to is usually the one being looked for.
 */
export async function GET(request: Request) {
  const gate = await requireFiresideAdmin();
  if (!gate.allowed) return gate.response;

  const url = new URL(request.url);
  const requested = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(requested) && requested > 0 ? requested : 1;

  try {
    const total = await countAllThreads();
    // Paged, never an endless list — accessibility rule. An out-of-range page clamps to the last
    // one rather than showing nothing, so a linked page number still renders after the list shrinks.
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, lastPage);
    const threads = await listAllThreads(PAGE_SIZE, (safePage - 1) * PAGE_SIZE);
    return NextResponse.json({ ok: true, threads, page: safePage, lastPage, total }, { status: 200 });
  } catch (error) {
    return failureResponse({
      summary: 'Unable to load the conversations',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'admin_threads_list',
      status: 503,
      audience: 'operator',
    });
  }
}
