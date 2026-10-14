import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import { SOCKET_RELAY_ERROR_CODE } from 'lib/socket-relay/constants';
import {
  SOCKET_RELAY_IMAGE_MAX_ALT_LENGTH,
  SOCKET_RELAY_IMAGE_MAX_BYTES,
  deleteRequestImage,
  readRequestImage,
  saveRequestImage,
  type SocketRelayImageUpload,
} from 'lib/socket-relay/images';
import { parseCommunityImageDimension, sniffCommunityImageType } from 'lib/feed/community-images';
import { reportError } from 'lib/observability/report';

// The one picture on a SocketRelay request.
//
// GET serves it to any member past the read gate, the same members who can open the request.
// PUT uploads or replaces it, owner or admin only. Multipart form: `image` (PNG, JPEG or WebP, at most
// 3 MB), `alt` (what the picture shows, required), `width` and `height`, and `acknowledged` = "1".
// The form shows the warning that an inappropriate picture is an automatic ban, with no exceptions,
// and the member ticks it before the file picker opens; an upload without the tick is refused.
// DELETE removes it, owner or admin only.

type RouteProps = { params: Promise<{ id: string }> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badRequest(message: string): NextResponse {
  return NextResponse.json({ ok: false, code: SOCKET_RELAY_ERROR_CODE.invalidPayload, message }, { status: 400 });
}

async function readRequestId(params: RouteProps['params']): Promise<string | null> {
  const { id } = await params;
  return UUID_PATTERN.test(id) ? id.toLowerCase() : null;
}

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

// Everything except the file's bytes: the acknowledgement, the description and the size.
function readFields(form: FormData): { error: NextResponse } | { file: File; altText: string; width: number; height: number } {
  if (readText(form, 'acknowledged') !== '1') {
    return { error: badRequest('Tick the box to confirm you have read the picture rule before uploading.') };
  }
  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0) return { error: badRequest('Choose a picture to upload.') };
  if (file.size > SOCKET_RELAY_IMAGE_MAX_BYTES) return { error: badRequest('That picture is larger than 3 MB, even after it was scaled down.') };
  const altText = readText(form, 'alt');
  if (!altText) return { error: badRequest('Describe what the picture shows. A member using a screen reader hears this instead of seeing it.') };
  if (altText.length > SOCKET_RELAY_IMAGE_MAX_ALT_LENGTH) return { error: badRequest(`The description is over ${SOCKET_RELAY_IMAGE_MAX_ALT_LENGTH} characters.`) };
  const width = parseCommunityImageDimension(form.get('width'));
  const height = parseCommunityImageDimension(form.get('height'));
  if (!width || !height) return { error: badRequest('The picture’s size did not come through. Choose it again.') };
  return { file, altText, width, height };
}

async function parseUpload(request: Request): Promise<{ error: NextResponse } | { image: SocketRelayImageUpload }> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { error: badRequest('Could not read what you sent.') };
  }
  const fields = readFields(form);
  if ('error' in fields) return fields;
  const bytes = new Uint8Array(await fields.file.arrayBuffer());
  const contentType = sniffCommunityImageType(bytes);
  if (!contentType) return { error: badRequest('Only PNG, JPEG and WebP pictures can be uploaded.') };
  return { image: { bytes, contentType, width: fields.width, height: fields.height, altText: fields.altText } };
}

export async function GET(_: Request, { params }: RouteProps) {
  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) return gate.response;

  const requestId = await readRequestId(params);
  if (!requestId) return badRequest('That picture address is not valid.');

  try {
    const image = await readRequestImage(requestId);
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
        // The address carries the upload time, so a replaced picture gets a new address. No shared
        // cache may keep it, so a removed picture is not handed out from somebody else's copy.
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'read_image' });
    return NextResponse.json({ ok: false, message: 'Unable to load the picture.' }, { status: 503 });
  }
}

export async function PUT(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) return gate.response;

  const requestId = await readRequestId(params);
  if (!requestId) return badRequest('That request address is not valid.');

  const parsed = await parseUpload(request);
  if ('error' in parsed) return parsed.error;

  try {
    const image = await saveRequestImage(requestId, gate.auth.userId, gate.auth.isAdmin, parsed.image);
    return NextResponse.json({ ok: true, image }, { status: 200 });
  } catch (error) {
    return socketRelayErrorResponse(error, 'The picture was not saved. Try again in a moment.');
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) return gate.response;

  const requestId = await readRequestId(params);
  if (!requestId) return badRequest('That request address is not valid.');

  try {
    await deleteRequestImage(requestId, gate.auth.userId, gate.auth.isAdmin);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return socketRelayErrorResponse(error, 'The picture was not removed. Try again in a moment.');
  }
}
