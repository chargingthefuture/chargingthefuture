import { NextResponse } from 'next/server';
import { reportError } from 'lib/observability/report';
import { normalizeUuid } from 'lib/feed/repository';
import { readCommunityPostImage } from 'lib/feed/community-images';
import { requireCommonsAccess } from '../../_lib';

// Serve the picture on a Commons post. Behind the same sign-in as the messages, and only while the
// post is still up. Pictures are not part of the signed-out public view of the Commons.

export async function GET(_request: Request, context: { params: Promise<{ postId: string }> }) {
  const gate = await requireCommonsAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { postId: rawPostId } = await context.params;
  const postId = normalizeUuid(rawPostId);
  if (!postId) {
    return NextResponse.json({ ok: false, message: 'That picture address is not valid.' }, { status: 400 });
  }

  try {
    const image = await readCommunityPostImage(postId);
    if (!image) {
      return NextResponse.json({ ok: false, message: 'That picture is no longer available.' }, { status: 404 });
    }
    return new Response(new Uint8Array(image.bytes), {
      status: 200,
      headers: {
        'Content-Type': image.contentType,
        'Content-Length': String(image.bytes.byteLength),
        // The type was checked from the file's own bytes on upload; nosniff stops a browser second-guessing it.
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
        // A post's picture never changes, but it is member-only, so no shared cache may keep it.
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    reportError(error, { area: 'commons', op: 'read_image' });
    return NextResponse.json({ ok: false, message: 'Unable to load the picture.' }, { status: 503 });
  }
}
