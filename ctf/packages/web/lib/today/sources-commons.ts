import type { SeTodayCard } from '@ctf/shared';
import { requireCommonsAccess } from 'app/api/commons/_lib';
import { queryDb } from 'lib/db/postgres';
import { FEED_DEFAULT_PAGE_SIZE } from 'lib/feed/constants';
import { listFeedTimeline } from 'lib/feed/repository';
import type { FeedTimelineItem } from 'lib/feed/types';
import { author, card, clip, type TodayViewer } from './card';

// Commons on Today: members' community posts, for exactly the members who can read them in 3.0.
// The check is the 3.0 Commons read's own (requireCommonsAccess); a member it turns away gets no
// Commons cards, and nothing else on Today changes. The posts come from the same read 3.0 uses
// (listFeedTimeline with the caller's role, community channel only), so a deleted, hidden or
// moderated post, one past its end, one a moderator has not accepted, or one from a member blocked
// either way never reaches Today. Today also leaves out a post written by a restricted account, as
// it does with card conversations; mutes apply with the rest of Today's cards. Each card is a story,
// so it lasts the week and takes a place among the 30 only after asks and offers. Questions asked in
// Commons are not shown here.

const TITLE_MAX = 140;

export function commonsPostCard(item: FeedTimelineItem): SeTodayCard | null {
  if (!item.sourceCommunityPostId || !item.community) return null;
  const title = clip(item.body, TITLE_MAX) ?? 'A post in Commons';
  return card({
    source: 'commons-post',
    sourceId: item.sourceCommunityPostId,
    kind: 'story',
    label: 'Story · from Commons',
    title,
    // The rest of a long post opens in place; a short one is all title.
    body: title.endsWith('…') ? clip(item.body, 600) : null,
    author: author(item.community.authorUserId, item.community.authorUsername),
    createdAtIso: item.publishedAtIso,
    href: '/',
    actions: [],
  });
}

// The posts on this page written by a restricted account, which Today leaves out.
async function restrictedPosts(postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const result = await queryDb<{ id: string }>(
    `SELECT p.id::text AS id FROM feed_community_posts p
      WHERE p.id = ANY($1::uuid[])
        AND EXISTS (SELECT 1 FROM account_restrictions r WHERE r.user_id = p.author_user_id AND r.is_restricted = TRUE)`,
    [postIds],
  );
  return new Set(result.rows.map((row) => row.id));
}

export async function commonsCards(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const gate = await requireCommonsAccess();
  if (!gate.allowed) return [];
  const posts = await listFeedTimeline(viewer.userId, gate.auth.role, { page: 1, pageSize: FEED_DEFAULT_PAGE_SIZE }, { channel: 'community' });
  const items = posts.items.filter((item) => !item.isDismissed && item.sourceCommunityPostId);
  const hidden = await restrictedPosts(items.map((item) => item.sourceCommunityPostId as string));
  return items
    .filter((item) => !hidden.has(item.sourceCommunityPostId as string))
    .map(commonsPostCard)
    .filter((item): item is SeTodayCard => item !== null);
}
