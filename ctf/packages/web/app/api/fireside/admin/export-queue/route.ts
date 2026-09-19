import { NextResponse } from 'next/server';
import { requireFiresideAdmin } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import { readPendingExportQueue } from 'lib/fireside/export-review';
import { failureResponse } from 'lib/errors/failure';

const PAGE_SIZE = 20;

/**
 * The moderation queue for copying comments out to the blog's published build.
 *
 * Each row carries the author's record here — how many comments they have written, how many were
 * removed, how many exports were refused or approved. Moderating one item at a time is a losing
 * race against somebody doing this on purpose; seeing the tally turns a run of small decisions into
 * one decision about the account.
 */
export async function GET(request: Request) {
  const gate = await requireFiresideAdmin();
  if (!gate.allowed) return gate.response;

  const url = new URL(request.url);
  const requested = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(requested) && requested > 0 ? requested : 1;

  try {
    // Paged, never an endless list — accessibility rule. The count, the clamp and the page all come
    // out of one call, because the count and the list used to be two queries with two different
    // ideas of what is in the queue.
    const queue = await readPendingExportQueue({ page, pageSize: PAGE_SIZE });
    return NextResponse.json({ ok: true, ...queue }, { status: 200 });
  } catch (error) {
    return failureResponse({
      summary: 'Unable to load the blog-export queue',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'export_queue_list',
      status: 503,
      audience: 'operator',
    });
  }
}
