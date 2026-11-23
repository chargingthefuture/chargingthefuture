import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedTimelineItem } from 'lib/feed/types';

const { requireCommonsAccess, listFeedTimeline, queryDb } = vi.hoisted(() => ({
  requireCommonsAccess: vi.fn(),
  listFeedTimeline: vi.fn(),
  queryDb: vi.fn(),
}));
vi.mock('app/api/commons/_lib', () => ({ requireCommonsAccess }));
vi.mock('lib/feed/repository', () => ({ listFeedTimeline }));
vi.mock('lib/db/postgres', () => ({ queryDb }));

import { commonsCards } from './sources-commons';

const POST = '11111111-1111-4111-8111-111111111111';
const POST_RESTRICTED = '22222222-2222-4222-8222-222222222222';
const POST_DISMISSED = '44444444-4444-4444-8444-444444444444';

function community(id: string, extra: Partial<FeedTimelineItem> = {}): FeedTimelineItem {
  return {
    id: `f-${id}`,
    itemType: 'community',
    sourceAnnouncementId: null,
    sourceQuestionId: null,
    sourceCommunityPostId: id,
    title: '',
    body: 'Anybody near the bus station tonight?',
    publishedAtIso: '2026-11-22T10:00:00.000Z',
    expiresAtIso: null,
    isRead: false,
    isDismissed: false,
    question: null,
    community: { id, body: 'x', category: 'general', authorUserId: `author-${id}`, authorUsername: 'marisol_k', replyCount: 0, replies: [], replyToPostId: null, quotedPost: null, reactions: [], image: null },
    announcement: null,
    ...extra,
  };
}

const viewer = { userId: 'viewer', isAdmin: false };
const page = (items: FeedTimelineItem[]) => ({ items, pagination: { page: 1, pageSize: 20, total: items.length } });

describe('commonsCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCommonsAccess.mockResolvedValue({ allowed: true, auth: { role: 'member' } });
    listFeedTimeline.mockResolvedValue(page([community(POST), community(POST_RESTRICTED), community(POST_DISMISSED, { isDismissed: true })]));
    queryDb.mockResolvedValue({ rows: [{ id: POST_RESTRICTED }] });
  });

  it('gives nothing to a member the 3.0 Commons read turns away, without reading posts', async () => {
    requireCommonsAccess.mockResolvedValue({ allowed: false });
    expect(await commonsCards(viewer)).toEqual([]);
    expect(listFeedTimeline).not.toHaveBeenCalled();
  });

  it('reads community posts only, with the caller role, as 3.0 does', async () => {
    await commonsCards(viewer);
    expect(listFeedTimeline).toHaveBeenCalledTimes(1);
    expect(listFeedTimeline).toHaveBeenCalledWith('viewer', 'member', { page: 1, pageSize: 20 }, { channel: 'community' });
  });

  it('makes story cards, leaving out dismissed posts and ones from restricted accounts', async () => {
    const cards = await commonsCards(viewer);
    expect(cards.map((card) => card.id)).toEqual([`commons-post:${POST}`]);
    expect(cards[0].kind).toBe('story');
    expect(cards[0].author).toEqual({ accountId: `author-${POST}`, handle: 'marisol_k' });
    expect(queryDb.mock.calls[0][1]).toEqual([[POST, POST_RESTRICTED]]);
  });

  it('clips a long post in the title and gives the rest in the body', async () => {
    const long = 'word '.repeat(80).trim();
    listFeedTimeline.mockResolvedValue(page([community(POST, { body: long })]));
    queryDb.mockResolvedValue({ rows: [] });
    const [card] = await commonsCards(viewer);
    expect(card.title.endsWith('…')).toBe(true);
    expect(card.body).toBe(long);
  });
});
