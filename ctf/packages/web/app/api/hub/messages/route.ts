import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import type { HubMessagesResponse, HubMessage } from 'lib/hub/types';
import type { FeedTimelineItem } from 'lib/feed/types';
import {
  FEED_ADMIN_MAX_COMMUNITY_POST_LENGTH,
  FEED_ERROR_CODE,
  FEED_MAX_COMMUNITY_POST_LENGTH,
} from 'lib/feed/constants';
import {
  createFeedCommunityPost,
  feedAuthorHandle,
  feedMentionTokens,
  listFeedTimeline,
  parsePaginationParams,
  resolveAnnouncementLinkedPlugins,
  validateFeedCommunityPostInput,
} from 'lib/feed/repository';
import { feedPostLength as normalizedPostLength } from 'lib/feed/normalize';
import { requireHubAccess } from '../_lib';
import { ensureMutationCsrf } from '../../feed/_lib';

// Survivor Hub consolidation: the Hub home channel is backed by the Feed model
// (feed_items) as the single source of truth. The channel is one blended stream
// interleaving admin announcements, AI Q&A, and peer-to-peer community posts.

function mapTimelineItemToHubMessage(
  item: FeedTimelineItem,
  linkedPluginsByAnnouncementId: Map<string, Array<{ slug: string; name: string }>>,
): HubMessage {
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

  // The linked plugins (0–3) for this announcement, resolved to { slug, name } for the clickable
  // "Open <Plugin>" chips. Only announcements carry them; keyed by the source announcement id.
  const linkedPlugins = isAnnouncement && item.sourceAnnouncementId
    ? linkedPluginsByAnnouncementId.get(item.sourceAnnouncementId) ?? []
    : [];

  // A peer post may quote another peer post (Signal-style reply). The quoted author handle
  // and short snippet are resolved server-side in the feed repository and carried here.
  const quotedMessage = isCommunity && item.community?.quotedPost
    ? {
        author: item.community.quotedPost.author,
        snippet: item.community.quotedPost.snippet,
        // The quoted post's id, so the client can scroll to the original when the quote is tapped.
        postId: item.community.replyToPostId,
      }
    : null;

  // Emoji reactions resolved server-side for the requesting member: from the community post for a
  // peer message, from the announcement for an official one. Other messages carry an empty array.
  const reactions = isCommunity && item.community
    ? item.community.reactions
    : isAnnouncement && item.announcement
      ? item.announcement.reactions
      : [];

  // Announcement-only: the id reactions/replies key on, and the reply count for the "N replies"
  // affordance on the official card. Peer posts and AI answers carry null / 0.
  const announcementId = isAnnouncement ? item.sourceAnnouncementId : null;
  const replyCount = isAnnouncement && item.announcement ? item.announcement.replyCount : 0;

  return {
    id: item.id,
    userId: authorUserId,
    username: authorUsername,
    displayName,
    avatarUrl: null,
    kind: item.itemType,
    title,
    linkedPlugins,
    text,
    sentAtIso: item.publishedAtIso,
    communityPostId: isCommunity ? item.sourceCommunityPostId : null,
    announcementId,
    quotedMessage,
    reactions,
    replyCount,
  };
}

export async function GET(request: Request) {
  const gate = await requireHubAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const pagination = parsePaginationParams(request.url);
    // Optional mentions filter (`?mentions=me`): show only messages whose body @-mentions
    // the CALLER. The handle forms are derived server-side from the authenticated user
    // (`@<username>` and the `@user-<id token>` pseudonym) — a client-supplied handle is
    // never trusted. Mentions mode is peer-chat only, so it reads just the community
    // channel (announcements and AI Q&A cards are not part of the mentions view).
    const params = new URL(request.url).searchParams;
    const mentionsMe = params.get('mentions') === 'me';
    const mentionHandles = mentionsMe
      ? feedMentionTokens(gate.identity.username, gate.auth.userId)
      : null;
    // Announcements filter (`?channel=announcements`, from the 📣 chip): return only official
    // announcements, including ones that scrolled off the recent page, so a member with limited
    // history can still surface them. Only this value is honored; anything else falls back to 'all'.
    // Mentions takes precedence when both are present.
    const announcementsOnly = !mentionsMe && params.get('channel') === 'announcements';
    // Deep-link "load around" (`?aroundPost=<id>` / `?aroundAnnouncement=<id>`, from a notification's
    // "Open"): return a page centered on that message so it lands even when it is older than the recent
    // page. It reads the unfiltered stream (a deep link is not a mentions/announcements view) and only
    // applies when no filter is active. An unknown/deleted id falls back to the normal recent page.
    const aroundCommunityPostId = !mentionsMe && !announcementsOnly ? params.get('aroundPost') : null;
    const aroundAnnouncementId =
      !mentionsMe && !announcementsOnly && !aroundCommunityPostId ? params.get('aroundAnnouncement') : null;
    const timeline = await listFeedTimeline(
      gate.auth.userId,
      gate.auth.role,
      pagination,
      mentionsMe
        ? { channel: 'community', mentionHandles }
        : announcementsOnly
          ? { channel: 'announcements' }
          : { channel: 'all', aroundCommunityPostId, aroundAnnouncementId },
    );

    // Resolve the linked plugin (if any) for the announcements on this page, so each official card
    // can render a clickable "Open <Plugin>" chip. One batched lookup for all announcement ids.
    const announcementIds = timeline.items
      .filter((item) => item.itemType === 'announcement' && item.sourceAnnouncementId)
      .map((item) => item.sourceAnnouncementId as string);
    const linkedPluginsByAnnouncementId = await resolveAnnouncementLinkedPlugins(announcementIds);

    // Feed timeline is newest-first; present oldest-first for the chat stream.
    const messages: HubMessage[] = [...timeline.items]
      .reverse()
      .map((item) => mapTimelineItemToHubMessage(item, linkedPluginsByAnnouncementId));

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
  const quoted = value as { author?: unknown; snippet?: unknown; postId?: unknown };
  if (typeof quoted.author !== 'string' || typeof quoted.snippet !== 'string') {
    return null;
  }
  const author = quoted.author.trim();
  const snippet = quoted.snippet.trim();
  if (author.length === 0 || snippet.length === 0) {
    return null;
  }
  const postId = typeof quoted.postId === 'string' && quoted.postId.trim().length > 0 ? quoted.postId.trim() : null;
  // Cap the echoed snippet so a crafted request cannot inflate the message payload.
  return { author: author.slice(0, 160), snippet: snippet.slice(0, 160), postId };
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
  // Admins (the owner) get a higher length + link cap so a detailed welcome/help post is not blocked
  // as spam; members keep the low caps.
  const isPrivileged = gate.auth.isAdmin;
  const maxLength = isPrivileged ? FEED_ADMIN_MAX_COMMUNITY_POST_LENGTH : FEED_MAX_COMMUNITY_POST_LENGTH;
  if (!text || !validateFeedCommunityPostInput(input, maxLength)) {
    // Name the length when that is the reason. The composer blocks an over-limit send before it gets
    // here, but a client with a wrong cap (an out-of-date tab, the API called directly) would
    // otherwise get "must be a valid community post" and no idea what to change.
    const overBy = normalizedPostLength(text) - maxLength;
    return NextResponse.json(
      {
        ok: false,
        message:
          overBy > 0
            ? `That message is ${overBy.toLocaleString()} characters over the ${maxLength.toLocaleString()}-character limit. Shorten it, or split it into two messages.`
            : 'Message text must be a valid community post.',
      },
      { status: 400 },
    );
  }

  try {
    // A message posted from the Hub input is a peer-to-peer community post.
    const authorUsername = gate.auth.username ?? null;
    const result = await createFeedCommunityPost(gate.auth.userId, input, authorUsername, isPrivileged);

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
      linkedPlugins: [],
      text,
      sentAtIso: result.createdAtIso,
      communityPostId: result.postId,
      // A composer message is a peer post, never an announcement.
      announcementId: null,
      // Echo the quote the sender saw so the optimistic message renders it immediately. The
      // next polled read re-resolves it authoritatively from the stored reply_to_post_id.
      quotedMessage: replyToPostId ? echoedQuote : null,
      // A freshly created post has no reactions yet.
      reactions: [],
      // Peer posts are not replied to through the announcement thread.
      replyCount: 0,
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
