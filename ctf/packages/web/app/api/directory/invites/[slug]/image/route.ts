import { NextResponse } from 'next/server';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { requireInviteReader } from 'lib/directory/invite-access';
import { normalizeInviteSlug } from 'lib/directory/invite-input';
import { readDirectoryInviteImage } from 'lib/directory/invites';
import { failureResponse } from 'lib/errors/failure';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';

// The picture on one invite. A signed-in account (any tier, same gate as the wall) gets any of them.
// A signed-out visitor gets only the picture on a public invite, one already published on the blog;
// a private invite's picture is a screenshot of what the person wrote, which is more than the name
// and opening words a visitor may see, so for them it answers as the gate does (401).
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const gate = await requireInviteReader();
  const publicOnly = !gate.allowed;
  if (publicOnly) {
    const limited = enforcePublicReadRateLimit(request, 'directory-invite-image');
    if (limited) return limited;
  }

  const { slug: rawSlug } = await context.params;
  const slug = normalizeInviteSlug(rawSlug);
  if (!slug) {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: 'That picture address is not valid.' },
      { status: 400 },
    );
  }

  try {
    const image = await readDirectoryInviteImage(slug, { publicOnly });
    if (!image && !gate.allowed) {
      return gate.response;
    }
    if (!image) {
      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: 'That invitation has no picture, or it was removed.' },
        { status: 404 },
      );
    }
    return new Response(new Uint8Array(image.bytes), {
      status: 200,
      headers: {
        'Content-Type': image.contentType,
        'Content-Length': String(image.bytes.byteLength),
        // The type was checked from the picture's own bytes when it arrived.
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
        // The browser may keep it for a day; no shared cache may, because it needs a sign-in.
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    return failureResponse({
      summary: 'Could not load the picture',
      error,
      code: DIRECTORY_ERROR_CODE.persistenceUnavailable,
      area: 'directory',
      op: 'invite_image',
      audience: 'member',
    });
  }
}
