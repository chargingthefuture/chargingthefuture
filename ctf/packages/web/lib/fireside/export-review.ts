// Fireside — the two keys on copying a comment out to the blog's published build.
//
// Kept apart from repository.ts because it answers a different question. That file is about the
// conversation: who wrote what, who can see it, what an admin took down. This file is about one
// decision made twice — the author asking, and an admin agreeing — before any of it leaves the app
// for a page that is permanently archived and cannot be pulled back.
//
// The rule those two keys feed is mayExportToBlog in ./visibility.ts, which stays the only place
// that decides. Nothing here re-derives it.

import { queryDb } from 'lib/db/postgres';
// Through the platform interface, never lib/unlock directly — plugins stay isolated (rule 112).
import { listUnlockedUserIds } from 'lib/shared/unlock-interface';
import type { ExportReview, FiresideAuthorRecord, FiresideExportRequest } from './types';

export type ExportPreferenceOutcome = 'saved' | 'already_refused' | 'not_found';

/**
 * The author asks for this comment to be copied into the blog's published build, or takes the ask
 * back. Asking is one of the two keys; an admin holds the other, so switching this on queues the
 * request rather than granting it.
 *
 * Switching it off always works and always returns the comment to 'not_requested', including after
 * an approval. Consent is the author's to withdraw at any point before the copy is actually made.
 *
 * A comment an admin has already refused stays refused. Letting the switch re-queue it would make
 * refusing pointless: an account posting bait could simply toggle until somebody approved by
 * mistake.
 */
export async function setExportPreference(
  userId: string,
  commentId: string,
  exportToBlog: boolean,
): Promise<ExportPreferenceOutcome> {
  const current = await queryDb<{ export_review: ExportReview }>(
    `SELECT export_review FROM fireside_comments
      WHERE id = $1::uuid AND author_user_id = $2 AND status = 'visible'
      LIMIT 1`,
    [commentId, userId],
  );
  const row = current.rows[0];
  if (!row) return 'not_found';
  if (row.export_review === 'refused') return 'already_refused';

  const result = await queryDb(
    `UPDATE fireside_comments
        SET export_to_blog = $3,
            export_review = CASE WHEN $3 THEN 'pending' ELSE 'not_requested' END,
            export_reviewed_by = NULL,
            export_reviewed_at = NULL,
            updated_at = NOW()
      WHERE id = $1::uuid AND author_user_id = $2 AND status = 'visible'`,
    [commentId, userId, exportToBlog],
  );
  return (result.rowCount ?? 0) > 0 ? 'saved' : 'not_found';
}

/**
 * What one account has done here, counted in a single query.
 *
 * The reason this exists is that moderating item by item is a losing race against somebody who is
 * doing it deliberately. Seeing that an account has had four comments removed and two exports
 * refused turns a string of small decisions into one decision about the account.
 */
export async function getAuthorRecord(userId: string): Promise<FiresideAuthorRecord> {
  const result = await queryDb<{
    comments: string;
    removed: string;
    exports_refused: string;
    exports_approved: string;
  }>(
    `SELECT COUNT(*) AS comments,
            COUNT(*) FILTER (WHERE status = 'removed') AS removed,
            COUNT(*) FILTER (WHERE export_review = 'refused') AS exports_refused,
            COUNT(*) FILTER (WHERE export_review = 'approved') AS exports_approved
       FROM fireside_comments
      WHERE author_user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return {
    comments: Number(row?.comments ?? '0'),
    removed: Number(row?.removed ?? '0'),
    exportsRefused: Number(row?.exports_refused ?? '0'),
    exportsApproved: Number(row?.exports_approved ?? '0'),
  };
}

type ExportRequestRow = {
  id: string;
  body: string;
  author_user_id: string;
  author_username: string | null;
  post_repo: string;
  post_slug: string;
  post_title: string;
  requested_at: string;
};

/**
 * The queue an admin works: comments whose authors have asked for them to go into the blog build,
 * oldest first so nobody's request sits behind a newer one.
 *
 * Only comments from approved authors appear. An unapproved author's words are not publicly visible
 * in the app yet, so there is nothing to decide about publishing them further; their request waits
 * and arrives here when Unlock approves them.
 */
export async function listPendingExportRequests(limit = 20, offset = 0): Promise<FiresideExportRequest[]> {
  const result = await queryDb<ExportRequestRow>(
    `SELECT c.id::text AS id,
            c.body,
            c.author_user_id,
            c.author_username,
            t.post_repo, t.post_slug, t.post_title,
            to_char(c.updated_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS requested_at
       FROM fireside_comments c
       JOIN fireside_threads t ON t.id = c.thread_id
      WHERE c.export_review = 'pending' AND c.export_to_blog = TRUE AND c.status = 'visible'
      ORDER BY c.created_at ASC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  if (result.rows.length === 0) return [];

  const approved = await listUnlockedUserIds(result.rows.map((row) => row.author_user_id));
  const visible = result.rows.filter((row) => approved.has(row.author_user_id));

  return Promise.all(
    visible.map(async (row) => ({
      commentId: row.id,
      body: row.body,
      authorUserId: row.author_user_id,
      authorName: row.author_username || 'A member',
      postRepo: row.post_repo,
      postSlug: row.post_slug,
      postTitle: row.post_title,
      requestedAt: row.requested_at,
      authorRecord: await getAuthorRecord(row.author_user_id),
    })),
  );
}

export async function countPendingExportRequests(): Promise<number> {
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(*) AS count FROM fireside_comments
      WHERE export_review = 'pending' AND export_to_blog = TRUE AND status = 'visible'`,
  );
  return Number(result.rows[0]?.count ?? '0');
}

/**
 * The admin's half of the two keys. Only a pending request can be decided, so a second click cannot
 * overturn a decision by accident and an approval cannot be granted for something never asked for.
 */
export async function reviewExportRequest(input: {
  adminId: string;
  commentId: string;
  action: 'approve' | 'refuse';
  reason: string;
}): Promise<boolean> {
  const result = await queryDb(
    `UPDATE fireside_comments
        SET export_review = $3,
            export_reviewed_by = $2,
            export_reviewed_at = NOW(),
            export_refusal_reason = $4,
            updated_at = NOW()
      WHERE id = $1::uuid AND export_review = 'pending' AND status = 'visible'`,
    [
      input.commentId,
      input.adminId,
      input.action === 'approve' ? 'approved' : 'refused',
      input.action === 'refuse' ? input.reason : null,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}
