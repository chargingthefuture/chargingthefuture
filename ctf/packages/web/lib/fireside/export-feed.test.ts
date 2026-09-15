import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportReview, FiresideCommentStatus } from 'lib/fireside/types';

// The export feed is the one place text leaves the app for a build that web archives capture and
// nobody can pull back, so these tests are about what it refuses rather than what it returns. They
// read the SQL the module produces and answer it from a fixture, so no database is involved.
const executed: { sql: string; values: readonly unknown[] }[] = [];
let rows: Record<string, unknown>[] = [];
let approvedAuthors = new Set<string>();

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async (sql: string, values: readonly unknown[] = []) => {
    executed.push({ sql, values });
    return { rows, rowCount: rows.length };
  }),
}));

vi.mock('lib/shared/unlock-interface', () => ({
  listUnlockedUserIds: vi.fn(async () => approvedAuthors),
}));

const { FIRESIDE_EXPORT_SCAN_LIMIT, isReadableExportCursor, listExportableComments } = await import(
  'lib/fireside/export-review'
);

type RowOverrides = {
  id?: string;
  author?: string;
  status?: FiresideCommentStatus;
  exportToBlog?: boolean;
  exportReview?: ExportReview;
};

function row(overrides: RowOverrides = {}): Record<string, unknown> {
  return {
    id: overrides.id ?? 'comment-1',
    parent_comment_id: null,
    body: 'Something worth keeping.',
    author_user_id: overrides.author ?? 'author-1',
    author_username: 'Ada',
    status: overrides.status ?? 'visible',
    export_to_blog: overrides.exportToBlog ?? true,
    export_review: overrides.exportReview ?? 'approved',
    created_at: '2026-09-14T10:00:00Z',
    created_at_cursor: '2026-09-14 10:00:00.000000+00',
    post_repo: 'chargingthefuture',
    post_slug: 'a-post',
    post_title: 'A post',
  };
}

beforeEach(() => {
  executed.length = 0;
  rows = [];
  approvedAuthors = new Set(['author-1']);
});

describe('listExportableComments', () => {
  it('returns a comment only when all four conditions hold', async () => {
    rows = [row()];
    const page = await listExportableComments();
    expect(page.comments.map((comment) => comment.commentId)).toEqual(['comment-1']);
    expect(page.comments[0].authorName).toBe('Ada');
  });

  it('drops a comment whose author is not approved, even though the database returned it', async () => {
    rows = [row({ author: 'not-approved' })];
    const page = await listExportableComments();
    expect(page.comments).toEqual([]);
    // Scanned, not kept: the row was read and refused here rather than in SQL, which is what keeps
    // the decision in mayExportToBlog.
    expect(page.scanned).toBe(1);
  });

  it('refuses a row the database hands back with either key turned off', async () => {
    rows = [
      row({ id: 'no-author-ask', exportToBlog: false }),
      row({ id: 'no-admin-answer', exportReview: 'pending' }),
      row({ id: 'admin-declined', exportReview: 'refused' }),
      row({ id: 'taken-down', status: 'withdrawn' }),
      row({ id: 'removed-by-admin', status: 'removed' }),
    ];
    const page = await listExportableComments();
    expect(page.comments).toEqual([]);
  });

  it('never carries a user id out of the app', async () => {
    rows = [row()];
    const page = await listExportableComments();
    expect(JSON.stringify(page.comments)).not.toContain('author-1');
  });

  it('names an author who never set a username without leaving the field blank', async () => {
    rows = [{ ...row(), author_username: '' }];
    const page = await listExportableComments();
    expect(page.comments[0].authorName).toBe('A member');
  });

  it('stops when the scan comes back short, and hands back a cursor when it does not', async () => {
    rows = [row()];
    expect((await listExportableComments()).nextCursor).toBeNull();

    rows = Array.from({ length: 2 }, (_, index) => row({ id: `comment-${index}` }));
    const page = await listExportableComments({ limit: 2 });
    expect(page.nextCursor).toBe('2026-09-14 10:00:00.000000+00|comment-1');
  });

  it('steps the cursor over a row it scanned and dropped, so nothing is skipped', async () => {
    rows = [row({ id: 'kept' }), row({ id: 'dropped', author: 'not-approved' })];
    const page = await listExportableComments({ limit: 2 });
    expect(page.comments.map((comment) => comment.commentId)).toEqual(['kept']);
    expect(page.nextCursor).toBe('2026-09-14 10:00:00.000000+00|dropped');
  });

  it('asks the database for no more than the scan ceiling, whatever it is told', async () => {
    rows = [];
    await listExportableComments({ limit: FIRESIDE_EXPORT_SCAN_LIMIT * 10 });
    expect(executed[0].values[2]).toBe(FIRESIDE_EXPORT_SCAN_LIMIT);

    executed.length = 0;
    await listExportableComments({ limit: 0 });
    expect(executed[0].values[2]).toBe(1);
  });

  it('starts from the oldest comment when handed a cursor it cannot read', async () => {
    // The route refuses such a cursor outright (isReadableExportCursor below); this is the second
    // line of that defense, so a caller that gets past it reads from the start rather than from an
    // arbitrary point.
    rows = [];
    await listExportableComments({ cursor: 'nonsense-with-no-separator' });
    expect(executed[0].values[0]).toBeNull();
    expect(executed[0].values[1]).toBeNull();
  });

  it('narrows the scan no further than the rule it defers to', async () => {
    rows = [];
    await listExportableComments();
    const sql = executed[0].sql;
    // Three of mayExportToBlog's four conditions, and deliberately never the fourth: author
    // approval is decided in code so a change to the rule cannot be silently overruled by SQL.
    expect(sql).toContain("c.status = 'visible'");
    expect(sql).toContain('c.export_to_blog = TRUE');
    expect(sql).toContain("c.export_review = 'approved'");
  });
});

describe('isReadableExportCursor', () => {
  it('accepts a cursor this feed issued', () => {
    expect(isReadableExportCursor('2026-09-14 10:00:00.000000+00|comment-1')).toBe(true);
  });

  it('refuses one with nothing on either side of the separator, or no separator at all', () => {
    expect(isReadableExportCursor('nonsense')).toBe(false);
    expect(isReadableExportCursor('|comment-1')).toBe(false);
    expect(isReadableExportCursor('2026-09-14 10:00:00.000000+00|')).toBe(false);
  });
});
