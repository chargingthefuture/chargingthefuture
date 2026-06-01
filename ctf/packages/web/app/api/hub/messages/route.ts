import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import type { HubMessagesResponse, HubMessage } from 'lib/hub/types';
import type { FeedTimelineItem } from 'lib/feed/types';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import {
  createFeedCommunityPost,
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
  const displayName = isCommunity ? 'Community member' : 'Survivor Hub';

  // Announcements lead with their title; questions/community posts are body-only.
  const text = item.itemType === 'announcement' && item.title
    ? `${item.title}\n\n${item.body}`
    : item.body;

  return {
    id: item.id,
    userId: authorUserId,
    username: null,
    displayName,
    avatarUrl: null,
    text,
    sentAtIso: item.publishedAtIso,
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
    // the Next.js onRequestError hook), and console output is not visible in prod
    // on mobile — so report explicitly.
    console.error('[Hub] Failed to read messages:', error);
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
};

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
  const input = { body: text };
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
    const result = await createFeedCommunityPost(gate.auth.userId, input);

    // Normalize to the same public author shape as mapTimelineItemToHubMessage so the
    // optimistic send and the next polled copy share a dedup key (from, senderLabel, text, time).
    const message: HubMessage = {
      id: result.postId,
      userId: gate.identity.userId,
      username: null,
      displayName: 'Community member',
      avatarUrl: null,
      text,
      sentAtIso: result.createdAtIso,
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

    // Unexpected failure (e.g. a database error): report the real cause to Sentry and
    // the server log so it is diagnosable in prod (console is not visible on mobile,
    // and caught errors do not reach Sentry on their own). The user still gets a
    // generic message — the underlying error is not safe to leak to the client.
    console.error('[Hub] Failed to create community post:', error);
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
