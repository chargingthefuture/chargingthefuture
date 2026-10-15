import { NextResponse } from 'next/server';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { requireInviteReader } from 'lib/directory/invite-access';
import { normalizeInviteSlug } from 'lib/directory/invite-input';
import { readDirectoryInviteImage } from 'lib/directory/invites';
import { failureResponse } from 'lib/errors/failure';

// The picture on one invite, shown only inside the full invitation, which needs a sign-in (any tier,
// same gate as the wall). A signed-out visitor sees cards without pictures, so for them this answers
// as the gate does (401).
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const gate = await requireInviteReader();
  if (!gate.allowed) {
    return gate.response;
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
    const image = await readDirectoryInviteImage(slug);
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
