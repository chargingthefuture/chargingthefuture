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
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    repo: url.searchParams.get('repo') ?? '',
    slug: url.searchParams.get('slug') ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: FIRESIDE_ERROR_CODE.invalidPayload, message: 'A post repo and slug are both required.' },
      { status: 400 },
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
      { status: 200 },
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
