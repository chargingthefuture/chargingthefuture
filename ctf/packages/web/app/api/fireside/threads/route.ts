import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readerIdentity } from 'lib/fireside/_lib';
import { FIRESIDE_ERROR_CODE } from 'lib/fireside/constants';
import { listThreadComments } from 'lib/fireside/repository';
import { failureResponse } from 'lib/errors/failure';

const querySchema = z.object({
  repo: z.string().min(1).max(200),
  slug: z.string().min(1).max(400),
});

/**
 * The conversation under one blog post. Public: no account, no sign-in, no gate.
 *
 * This is the one route in the app that answers an unauthenticated caller with member-written
 * content, and it is deliberate. The blog is public, so the conversation under it is public too —
 * the inversion of Quora, which gates reading as well as writing. Writing is still gated, and
 * nothing an unapproved member writes appears here.
 *
 * What it returns carries a display name and never a user id or an email, because everything on
 * this shape is on the open web. A signed-in reader additionally sees their own held comments, so
 * nobody is left wondering where their words went.
 *
 * It answers a cross-origin caller, so the blog itself can render the conversation under a post
 * without sending anybody anywhere. Read-only and already public, so the header gives away nothing
 * that a plain visit to this URL does not; no credentials are accepted cross-origin, which is why
 * the signed-in reader's own held comments only appear on the app's own pages. Writing stays
 * same-origin and keeps its CSRF and origin checks.
 */
const PUBLIC_READ_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  // No Access-Control-Allow-Credentials: a cross-origin caller gets the signed-out view, never a
  // reader's own held comments, whatever cookies their browser holds for this app.
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // A conversation changes slowly and the blog is a static site; a short shared cache keeps a
  // popular post from asking the database on every visit.
  'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
} as const;

/** Answers the browser's preflight so a cross-origin read from the blog is allowed to proceed. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_READ_HEADERS });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    repo: url.searchParams.get('repo') ?? '',
    slug: url.searchParams.get('slug') ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: FIRESIDE_ERROR_CODE.invalidPayload, message: 'A post repo and slug are both required.' },
      { status: 400, headers: PUBLIC_READ_HEADERS },
    );
  }

  const reader = await readerIdentity();

  try {
    const { thread, comments } = await listThreadComments(
      { repo: parsed.data.repo, slug: parsed.data.slug },
      reader.userId,
    );
    return NextResponse.json(
      {
        ok: true,
        thread: thread ? { id: thread.id, isClosed: thread.isClosed, commentCount: thread.commentCount } : null,
        comments,
        viewer: { isSignedIn: reader.userId != null },
      },
      { status: 200, headers: PUBLIC_READ_HEADERS },
    );
  } catch (error) {
    return failureResponse({
      summary: 'Unable to load this conversation',
      error,
      code: FIRESIDE_ERROR_CODE.persistenceUnavailable,
      area: 'fireside',
      op: 'threads_read',
      status: 503,
      audience: 'member',
      extra: { repo: parsed.data.repo, slug: parsed.data.slug },
    });
  }
}
