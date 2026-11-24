import { seCardItemRef, type SeTodayCard } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';
import { readBlogPosts } from 'lib/daily-posts/source';
import { postRefFromUrl } from 'lib/fireside/card-thread';
import { reportError } from 'lib/observability/report';
import type { TodayViewer } from './card';
import { isStoryCard } from './cards/story';

// Which of one Today read's cards the member took part in, for Me → Open (seOpenCards): answered,
// wrote in publicly or just you two, or asked or was asked to talk just you two on
// (commons_item_answers, commons_item_messages, commons_item_pair_requests), or, on a blog story,
// wrote a comment still shown in its Fireside thread. Two reads for the entire list, both by the
// member's own id. A failed read leaves every card unmarked and is reported; Today itself is
// unchanged either way.

async function joinedInStore(viewerId: string, cards: readonly SeTodayCard[]): Promise<Set<string>> {
  const refs = cards.map((card) => ({ id: card.id, ...seCardItemRef(card.id) }));
  const result = await queryDb<{ plugin: string; item_id: string }>(
    `SELECT DISTINCT x.plugin, x.item_id FROM (
       SELECT plugin, item_id FROM commons_item_answers WHERE account_id = $1
       UNION SELECT plugin, item_id FROM commons_item_messages WHERE author_id = $1
       UNION SELECT plugin, item_id FROM commons_item_pair_requests WHERE user_low = $1 OR user_high = $1
     ) x JOIN unnest($2::text[], $3::text[]) AS wanted(plugin, item_id) ON wanted.plugin = x.plugin AND wanted.item_id = x.item_id`,
    [viewerId, refs.map((ref) => ref.plugin), refs.map((ref) => ref.itemId)],
  );
  const found = new Set(result.rows.map((row) => `${row.plugin}\n${row.item_id}`));
  return new Set(refs.filter((ref) => found.has(`${ref.plugin}\n${ref.itemId}`)).map((ref) => ref.id));
}

async function joinedInStories(viewerId: string, cards: readonly SeTodayCard[]): Promise<Set<string>> {
  const stories = cards.filter((card) => isStoryCard(card.id));
  if (stories.length === 0) return new Set();
  const result = await queryDb<{ post_repo: string; post_slug: string }>(
    `SELECT DISTINCT t.post_repo, t.post_slug FROM fireside_comments c JOIN fireside_threads t ON t.id = c.thread_id
      WHERE c.author_user_id = $1 AND c.status = 'visible'`,
    [viewerId],
  );
  if (result.rows.length === 0) return new Set();
  const written = new Set(result.rows.map((row) => `${row.post_repo}\n${row.post_slug}`));
  const read = await readBlogPosts();
  if (!read.ok) throw new Error(`The blog's post list could not be read: ${read.reason}`);
  const joined = new Set<string>();
  for (const card of stories) {
    const post = read.posts.find((item) => `blog-story:${item.slug}` === card.id);
    const ref = post ? postRefFromUrl(post.url) : null;
    if (ref && written.has(`${ref.repo}\n${ref.slug}`)) joined.add(card.id);
  }
  return joined;
}

export async function applyMemberJoined(viewer: TodayViewer, cards: SeTodayCard[]): Promise<SeTodayCard[]> {
  if (cards.length === 0) return cards;
  try {
    const [store, stories] = await Promise.all([joinedInStore(viewer.userId, cards), joinedInStories(viewer.userId, cards)]);
    return cards.map((card) => (store.has(card.id) || stories.has(card.id) ? { ...card, joined: true } : card));
  } catch (error) {
    reportError(error, { area: 'today', op: 'read_joined' });
    return cards;
  }
}
