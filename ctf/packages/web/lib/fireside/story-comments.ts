import { queryDb } from 'lib/db/postgres';
import { listUnlockedUserIds } from 'lib/shared/unlock-interface';
import { isPubliclyVisible } from './visibility';
import type { FiresideCommentStatus } from './types';

// When the comments anybody can read were written under each of a few blog posts, newest first and
// at most PER_POST each, for the story cards on Today: a member who marked a story done sees it come
// back with its new comments. Only publicly visible comments count (isPubliclyVisible: not taken
// down, by an author approved in Unlock). Matched by the post's slug.

const PER_POST = 50;

type Row = { post_slug: string; author_user_id: string; status: FiresideCommentStatus; created_at: Date };

export async function listStoryCommentTimes(slugs: readonly string[]): Promise<Map<string, string[]>> {
  const times = new Map<string, string[]>();
  if (slugs.length === 0) return times;
  const result = await queryDb<Row>(
    `SELECT t.post_slug, c.author_user_id, c.status, c.created_at
       FROM fireside_comments c JOIN fireside_threads t ON t.id = c.thread_id
      WHERE t.post_slug = ANY($1::text[]) AND c.status = 'visible'
      ORDER BY c.created_at DESC
      LIMIT ${PER_POST * 10}`,
    [slugs],
  );
  const approved = await listUnlockedUserIds(result.rows.map((row) => row.author_user_id));
  for (const row of result.rows) {
    if (!isPubliclyVisible({ status: row.status, authorIsApproved: approved.has(row.author_user_id) })) continue;
    const list = times.get(row.post_slug) ?? [];
    if (list.length < PER_POST) list.push(new Date(row.created_at).toISOString());
    times.set(row.post_slug, list);
  }
  return times;
}
