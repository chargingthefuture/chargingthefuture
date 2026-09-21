import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import {
  FIRESIDE_EXPORT_SCAN_LIMIT,
  isReadableExportCursor,
  listExportableComments,
} from 'lib/fireside/export-review';
import { failureResponse } from 'lib/errors/failure';

const querySchema = z.object({
  // Refused rather than ignored. A build that passes a cursor this feed could not have issued is
  // resuming from nowhere, and silently answering from the oldest comment would let it look like it
  // worked.
  cursor: z.string().min(1).max(200).refine(isReadableExportCursor).nullable(),
  limit: z.coerce.number().int().min(1).max(FIRESIDE_EXPORT_SCAN_LIMIT).nullable(),
});

/**
 * The feed the blog's published build reads, so the conversation ships inside the build rather than
 * being fetched into the page afterwards. A comment that is only fetched at read time is not in the
 * build, and so is not in what a web archive captures.
 *
 * What it answers with is decided entirely by `mayExportToBlog` — the author asked, an admin agreed,
 * the comment is visible, and its author is approved. Reading `export_to_blog` or `export_review`
 * on their own would each walk past the other key, which is the failure this route is shaped to
 * make impossible: it has no filter of its own to get wrong.
 *
 * Public, for the same reason `/api/fireside/threads` is: every comment it returns is already
 * readable by anybody on that route, and the caller is a static build with nowhere to keep a
 * secret. Being public adds no reader who could not already read these words one post at a time.
 *
 * Read by the cursor, not by counting. Rows are dropped after the database returns them — a comment
 * whose author is not approved is scanned and not kept — so the cursor steps over what was scanned
 * and a caller keeps asking until it comes back null.
 */
const PUBLIC_READ_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  // No Access-Control-Allow-Credentials: nothing here depends on who is asking, and no cookie
  // should ever change what this route answers.
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // A build reads this a handful of times per deploy, and an approval takes effect on the next
  // build rather than the next second, so a longer shared cache costs nothing.
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=900',
} as const;

/** Answers the browser's preflight, so the feed can also be read from the blog's own origin. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_READ_HEADERS });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    cursor: url.searchParams.get('cursor'),
    limit: url.searchParams.get('limit'),
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: FIRESIDE_ERROR_CODE.invalidPayload,
        message: `A cursor must be the one returned by the previous read, and a limit must be an integer from 1 to ${FIRESIDE_EXPORT_SCAN_LIMIT}.`,
      },
      { status: 400, headers: PUBLIC_READ_HEADERS },
    );
  }

  try {
    const page = await listExportableComments({
      cursor: parsed.data.cursor,
      limit: parsed.data.limit ?? undefined,
    });
    return NextResponse.json(
      { ok: true, comments: page.comments, scanned: page.scanned, nextCursor: page.nextCursor },
      { status: 200, headers: PUBLIC_READ_HEADERS },
    );
  } catch (error) {
    return failureResponse({
      summary: 'Unable to read the blog export feed',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'export_feed_read',
      status: 503,
      audience: 'member',
      extra: { cursor: parsed.data.cursor, limit: parsed.data.limit },
    });
  }
}
