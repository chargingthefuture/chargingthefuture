import { beforeEach, describe, expect, it, vi } from 'vitest';

// A reaction counts in public once the person who left it is approved in Unlock, the same rule as a
// comment (fireside.reaction.toggle in the access policy). The counts used to be built from every
// row, so an account that had never finished Unlock could move the number every reader of the blog
// sees. These tests drive the public thread read against a fixture, so no database is involved.
const THREAD_ID = '11111111-1111-4111-8111-111111111111';
const COMMENT_ID = '22222222-2222-4222-8222-222222222222';

let reactionRows: { comment_id: string; kind: string; reactor_user_id: string }[] = [];
let approved = new Set<string>();

vi.mock('lib/db/postgres', () => ({
  queryDb: vi.fn(async (sql: string) => {
    if (sql.includes('FROM fireside_threads')) {
      return {
        rows: [{ id: THREAD_ID, post_repo: 'wiki-site', post_slug: 'a-post', post_title: 'A post', is_closed: false, comment_count: '1' }],
        rowCount: 1,
      };
    }
    if (sql.includes('FROM fireside_reactions')) {
      return { rows: reactionRows, rowCount: reactionRows.length };
    }
    return {
      rows: [{
        id: COMMENT_ID,
        parent_comment_id: null,
        author_user_id: 'author',
        author_username: 'author',
        body: 'A comment that is public.',
        status: 'visible',
        export_to_blog: false,
        export_review: 'not_requested',
        export_refusal_reason: null,
        created_at: '2026-10-01T10:00:00.000Z',
        edited_at: null,
        post_repo: 'wiki-site',
        post_slug: 'a-post',
        post_title: 'A post',
      }],
      rowCount: 1,
    };
  }),
}));

vi.mock('lib/shared/unlock-interface', () => ({
  listUnlockedUserIds: vi.fn(async (ids: string[]) => new Set(ids.filter((id) => approved.has(id)))),
}));

const { listThreadComments } = await import('lib/fireside/repository');

const POST = { repo: 'wiki-site', slug: 'a-post' };

beforeEach(() => {
  approved = new Set(['author', 'approved-reader']);
  reactionRows = [
    { comment_id: COMMENT_ID, kind: 'helpful', reactor_user_id: 'approved-reader' },
    { comment_id: COMMENT_ID, kind: 'helpful', reactor_user_id: 'waiting-reader' },
    { comment_id: COMMENT_ID, kind: 'upvote', reactor_user_id: 'waiting-reader' },
  ];
});

describe('reaction counts', () => {
  it('leaves out reactions from people not yet approved, for a reader who is signed out', async () => {
    const { comments } = await listThreadComments(POST, null);
    expect(comments[0].reactions).toEqual({ recognize: 0, helpful: 1, same_here: 0, upvote: 0 });
  });

  it('leaves them out for another signed-in member too', async () => {
    const { comments } = await listThreadComments(POST, 'approved-reader');
    expect(comments[0].reactions.helpful).toBe(1);
    expect(comments[0].reactions.upvote).toBe(0);
  });

  it('counts the waiting member their own reactions, and shows them as pressed', async () => {
    const { comments } = await listThreadComments(POST, 'waiting-reader');
    expect(comments[0].reactions.helpful).toBe(2);
    expect(comments[0].reactions.upvote).toBe(1);
    expect(comments[0].viewerReactions).toEqual(['helpful', 'upvote']);
  });

  it('counts everything they left once they are approved, with nothing rewritten', async () => {
    approved.add('waiting-reader');
    const { comments } = await listThreadComments(POST, null);
    expect(comments[0].reactions.helpful).toBe(2);
    expect(comments[0].reactions.upvote).toBe(1);
  });
});
