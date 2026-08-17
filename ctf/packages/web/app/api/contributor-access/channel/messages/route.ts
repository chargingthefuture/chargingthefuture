import { NextResponse } from 'next/server';
import { requireGatedChannelAccess } from '../_lib';
import { ensureMutationCsrf } from '../../admin/_lib';
import {
  createGatedChannelPost,
  listGatedChannelMessages,
  validateGatedChannelPostBody,
  type GatedChannelMessage,
} from 'lib/contributor-access/channel-repository';
import { feedAuthorHandle } from 'lib/feed/author-handle';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Gated channel message history (GET) and posting (POST). Same architecture as the Commons: the
// database is the message source of truth; Stream is only the live layer (see ../join). Threads
// are Signal-style quoted replies — the same mechanism the Commons uses. There is no image or
// file upload path anywhere in this channel (proposal hard guardrail), and the Stream channel
// type has uploads disabled as well.

export async function GET() {
  const gate = await requireGatedChannelAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const messages = await listGatedChannelMessages(gate.auth.userId);
    return NextResponse.json({ ok: true, messages }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'contributor-access', op: 'channel_messages_read' });
    return NextResponse.json(
      { ok: false, message: 'Unable to read channel messages.' },
      { status: 503 },
    );
  }
}

type MessageRequestBody = {
  text?: unknown;
  replyToPostId?: unknown;
};

// Parse and validate the posting body: a required message text within the channel length limit and
// an optional quoted-reply target. Returns a 400 response when the text is missing or too long.
function parseChannelMessageInput(
  body: MessageRequestBody,
): { error: NextResponse } | { text: string; replyToPostId: string | null } {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const replyToPostId = typeof body.replyToPostId === 'string' && body.replyToPostId.trim().length > 0
    ? body.replyToPostId.trim()
    : null;
  if (!text || !validateGatedChannelPostBody(text)) {
    return {
      error: NextResponse.json(
        { ok: false, message: 'Message text is required and must fit the channel length limit.' },
        { status: 400 },
      ),
    };
  }
  return { text, replyToPostId };
}

// Map a create-post failure to its response. Known error codes carry their own status; anything
// else is reported and returned as a generic 503.
function mapChannelPostError(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : 'unknown_error';
  if (code === 'rate_limit_exceeded') {
    // Same limiter shape and threshold as the Commons community-post route (8 per 30 minutes,
    // counted per member in the database); the client shows this as the same error banner the
    // Commons shows when its posting limit trips.
    return NextResponse.json(
      { ok: false, code: 'rate_limit_exceeded', message: 'Channel posting rate limit exceeded. Wait a little before posting again.' },
      { status: 429 },
    );
  }
  if (code === 'content_policy_violation') {
    // Same content gate as the Commons (no raw <> markup, at most three links): the post is
    // refused outright and never stored, so it is never visible to anyone.
    return NextResponse.json(
      { ok: false, code: 'content_policy_violation', message: 'Message blocked by content moderation.' },
      { status: 422 },
    );
  }
  if (code === 'reply_target_not_found') {
    return NextResponse.json(
      { ok: false, message: 'The message you are replying to is no longer available.' },
      { status: 400 },
    );
  }
  reportError(error, { area: 'contributor-access', op: 'channel_message_create' });
  return NextResponse.json({ ok: false, message: 'Unable to send message.' }, { status: 503 });
}

export async function POST(request: Request) {
  const gate = await requireGatedChannelAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: MessageRequestBody;
  try {
    body = (await request.json()) as MessageRequestBody;
  } catch (error) {
    return NextResponse.json({ ok: false, message: 'Invalid JSON payload.', reason: failureReason(error) }, { status: 400 });
  }

  const parsed = parseChannelMessageInput(body);
  if ('error' in parsed) {
    return parsed.error;
  }
  const { text, replyToPostId } = parsed;

  try {
    const authorUsername = gate.auth.username ?? null;
    const result = await createGatedChannelPost({
      authorUserId: gate.auth.userId,
      authorUsername,
      body: text,
      replyToPostId,
    });

    const message: GatedChannelMessage = {
      id: result.postId,
      authorUserId: gate.auth.userId,
      authorUsername,
      displayName: feedAuthorHandle(authorUsername, gate.auth.userId),
      body: text,
      createdAtIso: result.createdAtIso,
      // Echoed as null; the next polled read resolves the authoritative quote from the stored
      // reply_to_post_id (the client keeps its own optimistic quote meanwhile).
      quotedMessage: null,
      reactions: [],
    };
    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    return mapChannelPostError(error);
  }
}
