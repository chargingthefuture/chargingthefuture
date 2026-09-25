import { NextResponse } from 'next/server';
import { reportError } from 'lib/observability/report';
import type { CommonsMessage } from 'lib/commons/types';
import { toCommonsMessageImage } from 'lib/commons/message-image';
import { FEED_ADMIN_MAX_COMMUNITY_POST_LENGTH, FEED_ERROR_CODE } from 'lib/feed/constants';
import { createFeedCommunityPost, feedAuthorHandle, validateFeedCommunityPostInput } from 'lib/feed/repository';
import {
  COMMUNITY_IMAGE_MAX_ALT_LENGTH,
  COMMUNITY_IMAGE_MAX_BYTES,
  parseCommunityImageDimension,
  sniffCommunityImageType,
  type CommunityPostImageUpload,
} from 'lib/feed/community-images';
import { requireCommonsAccess } from '../_lib';
import { ensureMutationCsrf } from '../../feed/_lib';

// Post a message with a picture to the Commons. Admins only (owner decision, 2026-09-25): the owner
// explains the product with screenshots, and Quora erases the accounts they were shared from. Members
// post through POST /api/commons/messages, which takes no picture.
//
// Multipart form: `image` (PNG, JPEG or WebP, at most 3 MB), `alt` (what the picture shows, required,
// read aloud by a screen reader), `text` (the message, required), `width` and `height` (the picture's
// size in pixels). The post and the picture are written in one transaction.

function badRequest(message: string): NextResponse {
  return NextResponse.json({ ok: false, code: FEED_ERROR_CODE.invalidPayload, message }, { status: 400 });
}

type ParsedUpload = { error: NextResponse } | { text: string; image: CommunityPostImageUpload };

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

// Everything except the file's bytes: the message, the description and the size.
function readFields(form: FormData): { error: NextResponse } | { text: string; altText: string; width: number; height: number; file: File } {
  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0) return { error: badRequest('Choose a picture to share.') };
  if (file.size > COMMUNITY_IMAGE_MAX_BYTES) return { error: badRequest('That picture is larger than 3 MB, even after it was scaled down.') };
  const altText = readText(form, 'alt');
  if (!altText) return { error: badRequest('Describe what the picture shows. A member using a screen reader hears this instead of seeing it.') };
  if (altText.length > COMMUNITY_IMAGE_MAX_ALT_LENGTH) return { error: badRequest(`The description is over ${COMMUNITY_IMAGE_MAX_ALT_LENGTH} characters.`) };
  const text = readText(form, 'text');
  if (!text || !validateFeedCommunityPostInput({ body: text }, FEED_ADMIN_MAX_COMMUNITY_POST_LENGTH)) {
    return { error: badRequest('Write a message to go with the picture.') };
  }
  const width = parseCommunityImageDimension(form.get('width'));
  const height = parseCommunityImageDimension(form.get('height'));
  if (!width || !height) return { error: badRequest('The picture’s size did not come through. Choose it again.') };
  return { text, altText, width, height, file };
}

async function parseUpload(request: Request): Promise<ParsedUpload> {
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
  if (!contentType) return { error: badRequest('That file is not a PNG, JPEG or WebP picture.') };
  return {
    text: fields.text,
    image: { bytes, contentType, width: fields.width, height: fields.height, altText: fields.altText },
  };
}

function mapImagePostError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : 'unknown_error';
  if (code === 'rate_limit_exceeded') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.rateLimitExceeded, message: 'Posting rate limit exceeded.' },
      { status: 429 },
    );
  }
  if (code === 'content_policy_violation') {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.moderationRejected, message: 'Post blocked by content moderation.' },
      { status: 422 },
    );
  }
  reportError(error, { area: 'commons', op: 'share_image' });
  return NextResponse.json({ ok: false, message: 'Unable to share the picture.' }, { status: 503 });
}

export async function POST(request: Request) {
  const gate = await requireCommonsAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  if (!gate.auth.isAdmin) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.forbidden, message: 'Only admins can share pictures in the Commons.' },
      { status: 403 },
    );
  }
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const parsed = await parseUpload(request);
  if ('error' in parsed) {
    return parsed.error;
  }

  try {
    const authorUsername = gate.auth.username ?? null;
    const result = await createFeedCommunityPost(gate.auth.userId, { body: parsed.text, image: parsed.image }, authorUsername, true);
    // The same shape POST /api/commons/messages echoes, so the sender's copy and the next polled copy
    // merge into one message.
    const message: CommonsMessage = {
      id: result.postId,
      userId: gate.identity.userId,
      username: authorUsername,
      displayName: feedAuthorHandle(authorUsername, gate.identity.userId),
      avatarUrl: null,
      kind: 'community',
      title: null,
      linkedPlugins: [],
      text: parsed.text,
      sentAtIso: result.createdAtIso,
      communityPostId: result.postId,
      announcementId: null,
      quotedMessage: null,
      reactions: [],
      replyCount: 0,
      image: toCommonsMessageImage(result.postId, parsed.image),
    };
    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    return mapImagePostError(error);
  }
}
