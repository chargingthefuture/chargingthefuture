import { NextResponse } from 'next/server';
import { reportError } from 'lib/observability/report';
import { isPublicCommunityReadOn, normalizeUuid } from 'lib/feed/repository';
import { readCommunityPostImage } from 'lib/feed/community-images';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { requireCommonsAccess } from '../../_lib';

// Serve the picture on a Commons post, only while the post is up.
//
// Members read it behind the same sign-in as the messages. Signed-out visitors read it when public
// viewing of the Commons is on, the same rule as GET /api/feed/public/community, and only for a post
// that public list would show. That is the reason pictures exist here (owner decision, 2026-09-25):
// a screenshot that only members can see does not replace one Quora erased with the account.

type Access = { publicOnly: boolean } | { response: Response };

async function resolveAccess(request: Request): Promise<Access> {
  const gate = await requireCommonsAccess();
  if (gate.allowed) return { publicOnly: false };
  if (!(await isPublicCommunityReadOn())) return { response: gate.response };
  // Per-IP brake on the anonymous read, as on the public post list.
  const limited = enforcePublicReadRateLimit(request, 'commons-image');
  return limited ? { response: limited } : { publicOnly: true };
}

export async function GET(request: Request, context: { params: Promise<{ postId: string }> }) {
  const { postId: rawPostId } = await context.params;
  const postId = normalizeUuid(rawPostId);
  if (!postId) {
    return NextResponse.json({ ok: false, message: 'That picture address is not valid.' }, { status: 400 });
  }

  try {
    const access = await resolveAccess(request);
    if ('response' in access) {
      return access.response;
    }
    const image = await readCommunityPostImage(postId, { publicOnly: access.publicOnly });
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
        // Browsers may keep it for a day. No shared cache may, so a deleted post's picture, or one
        // behind a public view that was turned off, is not handed out from somebody else's copy.
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    reportError(error, { area: 'commons', op: 'read_image' });
    return NextResponse.json({ ok: false, message: 'Unable to load the picture.' }, { status: 503 });
  }
}
