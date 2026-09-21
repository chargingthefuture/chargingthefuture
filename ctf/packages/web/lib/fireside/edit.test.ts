import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportReview, FiresideCommentStatus } from 'lib/fireside/types';

// An author rewriting their own comment. The rules are small and they are the kind that get
// re-derived wrongly somewhere else later, so they are pure functions with tests rather than
// conditions inside a handler. The repository test reads the SQL the module produces and answers it
// from a fixture, so no database is involved.
const executed: { sql: string; values: readonly unknown[] }[] = [];
let commentRow: Record<string, unknown> | null = null;

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async (sql: string, values: readonly unknown[] = []) => {
    executed.push({ sql, values });
    if (sql.includes('UPDATE fireside_comments')) {
      return { rows: [{ edited_at: '2026-09-18T10:00:00Z' }], rowCount: 1 };
    }
    return { rows: commentRow ? [commentRow] : [], rowCount: commentRow ? 1 : 0 };
  }),
}));

vi.mock('lib/shared/unlock-interface', () => ({
  listUnlockedUserIds: vi.fn(async () => new Set<string>()),
}));

const { refuseEdit } = await import('lib/fireside/visibility');
const { exportReviewAfterEdit } = await import('lib/fireside/export-review');
const { editOwnComment } = await import('lib/fireside/repository');

function givenComment(input: {
  status?: FiresideCommentStatus;
  exportReview?: ExportReview;
  isClosed?: boolean;
}): void {
  commentRow = {
    status: input.status ?? 'visible',
    export_review: input.exportReview ?? 'not_requested',
    is_closed: input.isClosed ?? false,
  };
}

beforeEach(() => {
  executed.length = 0;
  commentRow = null;
});

describe('refuseEdit', () => {
  // Whether the author is approved in Unlock is deliberately not an input: a held comment is the one
  // somebody is most likely to want to fix, and approval is a question about the person rather than
  // about any comment of theirs. So a held comment and a live one are the same case here.
  it('lets the author rewrite their comment in an open conversation, held or live', () => {
    expect(refuseEdit({ status: 'visible', threadIsClosed: false })).toBeNull();
  });

  it('refuses a comment an admin took down, because putting it back is theirs to do', () => {
    expect(refuseEdit({ status: 'removed', threadIsClosed: false })).toBe('removed_by_admin');
  });

  it('refuses a comment the author took down, which cannot be undone', () => {
    expect(refuseEdit({ status: 'withdrawn', threadIsClosed: false })).toBe('withdrawn');
  });

  it('refuses an edit in a closed conversation', () => {
    expect(refuseEdit({ status: 'visible', threadIsClosed: true })).toBe('thread_closed');
  });

  // A removal is somebody's decision about that comment; a closed thread is a decision about the
  // entire room. The comment's own state is answered first so the message names the nearer reason.
  it('names the removal rather than the closed thread when both hold', () => {
    expect(refuseEdit({ status: 'removed', threadIsClosed: true })).toBe('removed_by_admin');
  });
});

describe('exportReviewAfterEdit', () => {
  it('sends an approved export back to be read again', () => {
    expect(exportReviewAfterEdit('approved')).toBe('pending');
  });

  it('leaves a refusal refused, which a rewrite must not clear', () => {
    expect(exportReviewAfterEdit('refused')).toBe('refused');
  });

  it('leaves a waiting request waiting', () => {
    expect(exportReviewAfterEdit('pending')).toBe('pending');
  });

  it('does not start asking for a comment nobody asked to export', () => {
    expect(exportReviewAfterEdit('not_requested')).toBe('not_requested');
  });
});

describe('editOwnComment', () => {
  it('refuses a body under the minimum without asking the database anything', async () => {
    const outcome = await editOwnComment('u1', 'c1', ' ');
    expect(outcome).toEqual({ status: 'refused', reason: 'body_too_short' });
    expect(executed).toHaveLength(0);
  });

  it('refuses a body over the maximum', async () => {
    const outcome = await editOwnComment('u1', 'c1', 'x'.repeat(4001));
    expect(outcome).toEqual({ status: 'refused', reason: 'body_too_long' });
    expect(executed).toHaveLength(0);
  });

  it('answers a comment that is not the caller\'s own as though it is not there', async () => {
    commentRow = null;
    const outcome = await editOwnComment('u1', 'c1', 'The new words.');
    expect(outcome).toEqual({ status: 'not_found' });
    // Scoped by author in the statement, never by a client-supplied id alone.
    expect(executed[0].sql).toContain('c.author_user_id = $2');
    expect(executed[0].values).toContain('u1');
  });

  it('saves the new words and marks the comment as edited', async () => {
    givenComment({});
    const outcome = await editOwnComment('u1', 'c1', '  The new words.  ');
    expect(outcome).toEqual({
      status: 'edited',
      editedAt: '2026-09-18T10:00:00Z',
      exportRequeued: false,
    });
    const update = executed[1];
    expect(update.sql).toContain('edited_at = NOW()');
    expect(update.sql).toContain('author_user_id = $2');
    expect(update.values[2]).toBe('The new words.');
  });

  // An admin approved words, not a row. Changing them under an approval sends it back to the queue,
  // or a rewrite would be a way to put anything at all into a permanently archived build.
  it('sends an approved blog export back to the queue when the words change', async () => {
    givenComment({ exportReview: 'approved' });
    const outcome = await editOwnComment('u1', 'c1', 'Something else entirely.');
    expect(outcome).toEqual({
      status: 'edited',
      editedAt: '2026-09-18T10:00:00Z',
      exportRequeued: true,
    });
    expect(executed[1].values[3]).toBe('pending');
    expect(executed[1].values[4]).toBe(true);
  });

  it('leaves a refused export refused', async () => {
    givenComment({ exportReview: 'refused' });
    const outcome = await editOwnComment('u1', 'c1', 'Reworded.');
    expect(outcome).toMatchObject({ status: 'edited', exportRequeued: false });
    expect(executed[1].values[3]).toBe('refused');
  });

  it('refuses to rewrite a comment an admin took down, and writes nothing', async () => {
    givenComment({ status: 'removed' });
    const outcome = await editOwnComment('u1', 'c1', 'Please put it back.');
    expect(outcome).toEqual({ status: 'refused', reason: 'removed_by_admin' });
    expect(executed).toHaveLength(1);
  });

  it('refuses to rewrite a comment in a closed conversation, and writes nothing', async () => {
    givenComment({ isClosed: true });
    const outcome = await editOwnComment('u1', 'c1', 'One more thought.');
    expect(outcome).toEqual({ status: 'refused', reason: 'thread_closed' });
    expect(executed).toHaveLength(1);
  });
});
