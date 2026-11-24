import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeTodayCard } from '@ctf/shared';
import { FIRESIDE_BLOG_ARTICLE_BASE } from 'lib/fireside/constants';

const { queryDb } = vi.hoisted(() => ({ queryDb: vi.fn() }));
vi.mock('lib/db/postgres', () => ({ queryDb }));
vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));
vi.mock('lib/daily-posts/source', () => ({
  readBlogPosts: vi.fn(async () => ({ ok: true, posts: [{ slug: 'a-post', url: `${FIRESIDE_BLOG_ARTICLE_BASE}/chargingthefuture/a-post`, title: 'A post' }] })),
}));

import { applyMemberJoined } from './apply-joined';

const viewer = { userId: 'me-1', isAdmin: false } as never;

function cardOf(id: string): SeTodayCard {
  return { id, kind: 'ask', source: id.split(':')[0], label: 'Ask', title: 'T', body: null, author: null, createdAtIso: '2026-11-20T10:00:00.000Z', href: '/', actions: [] };
}

beforeEach(() => {
  queryDb.mockReset();
});

describe('applyMemberJoined', () => {
  it('marks the cards the member answered or wrote in, and blog stories they commented on', async () => {
    queryDb.mockImplementation(async (sql: string) =>
      sql.includes('fireside_comments') ? { rows: [{ post_repo: 'chargingthefuture', post_slug: 'a-post' }] } : { rows: [{ plugin: 'trust-transport', item_id: '7' }] },
    );
    const cards = await applyMemberJoined(viewer, [cardOf('trust-transport:7'), cardOf('socket-relay:8'), cardOf('blog-story:a-post')]);
    expect(cards.map((card) => card.joined ?? false)).toEqual([true, false, true]);
    expect(queryDb.mock.calls[0][1][0]).toBe('me-1');
  });

  it('leaves every card unmarked when the read fails', async () => {
    queryDb.mockRejectedValue(new Error('down'));
    const cards = await applyMemberJoined(viewer, [cardOf('trust-transport:7')]);
    expect(cards[0].joined).toBeUndefined();
  });
});
