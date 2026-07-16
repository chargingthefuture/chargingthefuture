import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import type { HubMessagesResponse, HubMessage } from 'lib/hub/types';
import type { FeedTimelineItem } from 'lib/feed/types';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import {
  createFeedCommunityPost,
  feedAuthorHandle,
  listFeedTimeline,
  parsePaginationParams,
  validateFeedCommunityPostInput,
} from 'lib/feed/repository';
import { requireHubAccess } from '../_lib';
import { ensureMutationCsrf } from '../../feed/_lib';

// Survivor Hub consolidation: the Hub home channel is backed by the Feed model
// (feed_items) as the single source of truth. The channel is one blended stream
// interleaving admin announcements, AI Q&A, and peer-to-peer community posts.

function mapTimelineItemToHubMessage(item: FeedTimelineItem): HubMessage {
  const isCommunity = item.itemType === 'community';
  const authorUserId = isCommunity ? item.community?.authorUserId ?? 'hub-system' : 'hub-system';
  // This route is gated to signed-in members, so a peer post leads with the
  // author's @username when we captured it at post time. Posts created before
  // usernames were stored (and official announcements/AI answers) fall back to
  // the pseudonymous "Community member" / "Survivor Hub" labels.
  const authorUsername = isCommunity ? item.community?.authorUsername ?? null : null;
  const displayName = isCommunity
    ? feedAuthorHandle(authorUsername, authorUserId)
    : 'Survivor Hub';

  // Announcements carry their title separately so the client can render it as a heading on the
  // official card; the message text is then the body alone. Questions/community posts are body-only.
  const isAnnouncement = item.itemType === 'announcement';
  const title = isAnnouncement ? item.title || null : null;
  const text = item.body;

  // A peer post may quote another peer post (Signal-style reply). The quoted author handle
  // and short snippet are resolved server-side in the feed repository and carried here.
  const quotedMessage = isCommunity && item.community?.quotedPost
    ? { author: item.community.quotedPost.author, snippet: item.community.quotedPost.snippet }
    : null;

  // Emoji reactions on the underlying community post, resolved server-side for the requesting
  // member. Non-community messages carry an empty array.
  const reactions = isCommunity && item.community ? item.community.reactions : [];

  return {
    id: item.id,
    userId: authorUserId,
    username: authorUsername,
    displayName,
    avatarUrl: null,
    kind: item.itemType,
    title,
    mandatory: isAnnouncement ? item.mandatory : false,
    text,
    sentAtIso: item.publishedAtIso,
    communityPostId: isCommunity ? item.sourceCommunityPostId : null,
    quotedMessage,
    reactions,
  };
}

export async function GET(request: Request) {
  const gate = await requireHubAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const pagination = parsePaginationParams(request.url);
    const timeline = await listFeedTimeline(
      gate.auth.userId,
      gate.auth.role,
      pagination,
      { channel: 'all' },
    );

    // Feed timeline is newest-first; present oldest-first for the chat stream.
    const messages: HubMessage[] = [...timeline.items]
      .reverse()
      .map(mapTimelineItemToHubMessage);

    const response: HubMessagesResponse = {
      channelId: 'community',
      messages,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // Caught errors do not reach Sentry on their own (only unhandled ones do via
    // the Next.js onRequestError hook), so report explicitly.
    Sentry.captureException(error, { tags: { area: 'hub', op: 'read_messages' } });
    return NextResponse.json(
      {
        ok: false,
        message: 'Unable to read Hub messages.',
      },
      { status: 503 },
    );
  }
}

type MessageRequestBody = {
  text?: unknown;
  // Optional id of the peer post this one quotes (Signal-style reply).
  replyToPostId?: unknown;
  // Optional author + snippet of the quoted post, echoed back on the created message so the
  // sender's optimistic copy can render the quote block immediately. Display-only; the
  // authoritative quote is re-resolved server-side on the next polled read.
  quotedMessage?: unknown;
};

function readQuotedMessage(value: unknown): HubMessage['quotedMessage'] {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const quoted = value as { author?: unknown; snippet?: unknown };
  if (typeof quoted.author !== 'string' || typeof quoted.snippet !== 'string') {
    return null;
  }
  const author = quoted.author.trim();
  const snippet = quoted.snippet.trim();
  if (author.length === 0 || snippet.length === 0) {
    return null;
  }
  // Cap the echoed snippet so a crafted request cannot inflate the message payload.
  return { author: author.slice(0, 160), snippet: snippet.slice(0, 160) };
}

export async function POST(request: Request) {
  const gate = await requireHubAccess();
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
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const replyToPostId = typeof body.replyToPostId === 'string' ? body.replyToPostId.trim() : null;
  const echoedQuote = readQuotedMessage(body.quotedMessage);
  const input = { body: text, replyToPostId };
  if (!text || !validateFeedCommunityPostInput(input)) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Message text must be a valid community post.',
      },
      { status: 400 },
    );
  }

  try {
    // A message posted from the Hub input is a peer-to-peer community post.
    const authorUsername = gate.auth.username ?? null;
    const result = await createFeedCommunityPost(gate.auth.userId, input, authorUsername);

    // Normalize to the same public author shape as mapTimelineItemToHubMessage so the
    // optimistic send and the next polled copy share a dedup key (from, senderLabel, text, time).
    const message: HubMessage = {
      id: result.postId,
      userId: gate.identity.userId,
      username: authorUsername,
      displayName: feedAuthorHandle(authorUsername, gate.identity.userId),
      avatarUrl: null,
      // A message posted from the composer is always a peer community post.
      kind: 'community',
      title: null,
      mandatory: false,
      text,
      sentAtIso: result.createdAtIso,
      communityPostId: result.postId,
      // Echo the quote the sender saw so the optimistic message renders it immediately. The
      // next polled read re-resolves it authoritatively from the stored reply_to_post_id.
      quotedMessage: replyToPostId ? echoedQuote : null,
      // A freshly created post has no reactions yet.
      reactions: [],
    };

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
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
    if (code === 'reply_target_invalid' || code === 'reply_target_not_found') {
      return NextResponse.json(
        { ok: false, message: 'The message you are replying to is no longer available.' },
        { status: 400 },
      );
    }

    // Unexpected failure (e.g. a database error): report the real cause to Sentry so it
    // is diagnosable in prod (caught errors do not reach Sentry on their own). The user
    // still gets a generic message — the underlying error is not safe to leak to the client.
    Sentry.captureException(error, { tags: { area: 'hub', op: 'send_message' } });
    return NextResponse.json(
      {
        ok: false,
        message: 'Unable to send message.',
      },
      { status: 503 },
    );
  }
}
