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
import type {
  ExportReview,
  FiresideAuthorRecord,
  FiresideCommentStatus,
  FiresideExportRequest,
  FiresideExportableComment,
} from './types';
import { mayExportToBlog } from './visibility';

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
 * Where a blog-export request stands once the author rewrites the comment it belongs to.
 *
 * An admin approves words, not a row. If the text changes afterwards, the thing they agreed to copy
 * onto a permanently archived page no longer exists, so the approval goes back to 'pending' and is
 * read again — otherwise a rewrite is a way to put anything at all into the build under an approval
 * somebody gave to something else.
 *
 * A refusal survives an edit, the same way it survives the author switching their own request off
 * and on again: a refusal that a rewrite can clear is not a refusal. Everything else is unchanged —
 * a pending request stays in the queue the admin has not reached yet, and a comment nobody asked to
 * export is not asking now.
 */
export function exportReviewAfterEdit(current: ExportReview): ExportReview {
  return current === 'approved' ? 'pending' : current;
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

/**
 * How many comments one call of the export feed will look at. A ceiling rather than a page size:
 * some of what is scanned is dropped below, so a caller reads the feed by following the cursor
 * until it comes back null, not by counting comments.
 */
export const FIRESIDE_EXPORT_SCAN_LIMIT = 200;

type ExportableRow = {
  id: string;
  parent_comment_id: string | null;
  body: string;
  author_user_id: string;
  author_username: string | null;
  status: FiresideCommentStatus;
  export_to_blog: boolean;
  export_review: ExportReview;
  created_at: string;
  created_at_cursor: string;
  post_repo: string;
  post_slug: string;
  post_title: string;
};

/**
 * Where a read of the export feed stopped, as `<created_at>|<id>`. Keyset rather than an offset
 * because rows are dropped after the database returns them — an offset counted against the scanned
 * set and the kept set at the same time, and would skip comments.
 */
export function parseExportCursor(cursor: string | null): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  const separator = cursor.lastIndexOf('|');
  if (separator <= 0 || separator === cursor.length - 1) return null;
  return { createdAt: cursor.slice(0, separator), id: cursor.slice(separator + 1) };
}

/**
 * Whether a caller's cursor is one this feed could have issued. The route refuses a cursor that
 * fails this rather than quietly starting over from the oldest comment: a build that believes it is
 * resuming and is in fact restarting looks like it is working, and only the wrong output says
 * otherwise.
 */
export function isReadableExportCursor(cursor: string): boolean {
  return parseExportCursor(cursor) != null;
}

/** A caller's limit, held between one row and the scan ceiling. */
function clampScanLimit(limit: number | undefined): number {
  if (limit == null || Number.isNaN(limit)) return FIRESIDE_EXPORT_SCAN_LIMIT;
  return Math.min(Math.max(limit, 1), FIRESIDE_EXPORT_SCAN_LIMIT);
}

/**
 * Where the next read starts, or null once there is nothing left. A scan that came back short of
 * what it asked for reached the end, which is the only signal a caller needs — counting comments
 * would not work, because a scanned row can be refused and returned to nobody.
 */
function nextExportCursor(rows: ExportableRow[], limit: number): string | null {
  if (rows.length < limit) return null;
  const last = rows[rows.length - 1];
  return `${last.created_at_cursor}|${last.id}`;
}

function toExportableComment(row: ExportableRow): FiresideExportableComment {
  return {
    commentId: row.id,
    parentCommentId: row.parent_comment_id,
    authorName: row.author_username || 'A member',
    body: row.body,
    createdAt: row.created_at,
    postRepo: row.post_repo,
    postSlug: row.post_slug,
    postTitle: row.post_title,
  };
}

/**
 * The comments the blog's published build may copy in, oldest first.
 *
 * `mayExportToBlog` decides every row, and nothing here decides anything itself. The WHERE clause
 * below narrows the scan for speed and is a deliberate superset of that rule — it applies three of
 * the four conditions and never the fourth, so a row the rule would allow can never be filtered out
 * before the rule sees it. **If `mayExportToBlog` is ever loosened, widen this clause first**, or
 * the database will quietly answer a question the rule was supposed to.
 *
 * Reading either export column on its own is what this shape exists to prevent. `export_to_blog`
 * alone is the author asking, which is one key; `export_review = 'approved'` alone is an admin
 * agreeing to a request the author may since have withdrawn. Copying on either one walks past the
 * other, into a build that web archives capture and nobody can pull back.
 */
export async function listExportableComments(input?: { cursor?: string | null; limit?: number }): Promise<{
  comments: FiresideExportableComment[];
  scanned: number;
  nextCursor: string | null;
}> {
  const limit = clampScanLimit(input?.limit);
  const cursor = parseExportCursor(input?.cursor ?? null);

  const result = await queryDb<ExportableRow>(
    `SELECT c.id::text AS id,
            c.parent_comment_id::text AS parent_comment_id,
            c.body,
            c.author_user_id,
            c.author_username,
            c.status,
            c.export_to_blog,
            c.export_review,
            to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS created_at,
            to_char(c.created_at, 'YYYY-MM-DD HH24:MI:SS.USOF') AS created_at_cursor,
            t.post_repo, t.post_slug, t.post_title
       FROM fireside_comments c
       JOIN fireside_threads t ON t.id = c.thread_id
      WHERE c.status = 'visible'
        AND c.export_to_blog = TRUE
        AND c.export_review = 'approved'
        AND ($1::timestamptz IS NULL OR (c.created_at, c.id) > ($1::timestamptz, $2::uuid))
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT $3`,
    [cursor?.createdAt ?? null, cursor?.id ?? null, limit],
  );

  const rows = result.rows;
  if (rows.length === 0) return { comments: [], scanned: 0, nextCursor: null };

  const approved = await listUnlockedUserIds(rows.map((row) => row.author_user_id));
  const comments = rows
    .filter((row) =>
      mayExportToBlog({
        status: row.status,
        authorIsApproved: approved.has(row.author_user_id),
        exportOptIn: row.export_to_blog,
        exportReview: row.export_review,
      }),
    )
    .map(toExportableComment);

  // The cursor tracks what was scanned, not what was kept, so a dropped row is still stepped over.
  return { comments, scanned: rows.length, nextCursor: nextExportCursor(rows, limit) };
}
