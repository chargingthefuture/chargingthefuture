import { beforeEach, describe, expect, it, vi } from 'vitest';

// The invite repository. What matters here: a card (the shape a signed-out caller, the landing site
// and the blog receive) carries name, opening, date and link and nothing else; paging clamps; and a
// listing's removal takes its invitations with it.

const queryDb = vi.fn();
vi.mock('lib/db/postgres', () => ({ queryDb: (...args: unknown[]) => queryDb(...args) }));

beforeEach(() => {
  queryDb.mockReset();
});

describe('cards', () => {
  it('carries only name, opening, date and the app link for a private invite', async () => {
    queryDb.mockResolvedValueOnce({
      rows: [{ name: 'Sam', opening: 'Sam fixes bicycles.', published_on: '2026-10-15', quora_handle: 'sam-example-1', public: false, blog_url: null }],
    });
    const { listLatestDirectoryInviteCards } = await import('./invites');
    const cards = await listLatestDirectoryInviteCards();
    expect(cards).toHaveLength(1);
    expect(Object.keys(cards[0]).sort()).toEqual(['date', 'name', 'opening', 'url']);
    expect(cards[0].url.endsWith('/apps/directory?invite=sam-example-1')).toBe(true);
    // The query names only the card columns, so nothing else can ride along.
    const sql = String(queryDb.mock.calls[0][0]);
    expect(sql).not.toMatch(/body_markdown|image|quora_url|directory_profile_id/);
  });
});

describe('public invites', () => {
  it('adds the blog address to a public card', async () => {
    queryDb.mockResolvedValueOnce({
      rows: [{ name: 'Ann', opening: 'Ann sews.', published_on: '2026-09-01', quora_handle: 'ann-1', public: true, blog_url: 'https://chargingthefuture.github.io/chargingthefuture/an-invitation-to-ann' }],
    });
    const { listLatestDirectoryInviteCards } = await import('./invites');
    const [card] = await listLatestDirectoryInviteCards();
    expect(card.blogUrl).toBe('https://chargingthefuture.github.io/chargingthefuture/an-invitation-to-ann');
  });

  it('gives the blurred private cards name and opening only, from private rows only', async () => {
    queryDb.mockResolvedValueOnce({ rows: [{ name: 'Sam', opening: 'Sam fixes bicycles.' }] });
    const { listLockedDirectoryInviteTeasers } = await import('./invites');
    const teasers = await listLockedDirectoryInviteTeasers();
    expect(teasers).toEqual([{ name: 'Sam', opening: 'Sam fixes bicycles.' }]);
    expect(String(queryDb.mock.calls[0][0])).toMatch(/WHERE NOT public/);
  });

  it('gives the open cards their blog address and no picture', async () => {
    queryDb.mockResolvedValueOnce({
      rows: [{ name: 'Ann', opening: 'Ann sews.', published_on: '2026-09-01', quora_handle: 'ann-1', public: true, blog_url: 'https://chargingthefuture.github.io/chargingthefuture/an-invitation-to-ann' }],
    });
    const { listOpenDirectoryInviteCards } = await import('./invites');
    const [card] = await listOpenDirectoryInviteCards(10, 0);
    expect(card).not.toHaveProperty('image');
    expect(String(queryDb.mock.calls[0][0])).not.toMatch(/image/);
    expect(card.blogUrl).toBe('https://chargingthefuture.github.io/chargingthefuture/an-invitation-to-ann');
  });
});

describe('clampInvitePage', () => {
  it('clamps out-of-range and junk pages and reports the range on screen', async () => {
    const { clampInvitePage } = await import('./invites');
    expect(clampInvitePage('99', 34)).toMatchObject({ page: 4, pageCount: 4, from: 31, to: 34 });
    expect(clampInvitePage('0', 34)).toMatchObject({ page: 1, from: 1, to: 10 });
    expect(clampInvitePage('abc', 34)).toMatchObject({ page: 1 });
    expect(clampInvitePage('1', 0)).toMatchObject({ page: 1, pageCount: 1, from: 0, to: 0 });
  });
});

describe('deleteInvitesForListing', () => {
  it('matches the profile id and the handle in the listing address', async () => {
    const { deleteInvitesForListing } = await import('./invites');
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await deleteInvitesForListing(client as never, 'profile-1', 'https://www.quora.com/profile/Sam-Example-1/');
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0][1]).toEqual(['profile-1', 'sam-example-1']);
  });

  it('matches by profile id alone when the listing has no address', async () => {
    const { deleteInvitesForListing } = await import('./invites');
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await deleteInvitesForListing(client as never, 'profile-2', null);
    expect(client.query.mock.calls[0][1]).toEqual(['profile-2', '']);
  });
});

describe('upsertDirectoryInvite', () => {
  it('refuses a Quora handle another slug already holds, without writing', async () => {
    queryDb.mockResolvedValueOnce({ rows: [{ slug: 'an-invitation-to-sam' }] });
    const { upsertDirectoryInvite } = await import('./invites');
    const result = await upsertDirectoryInvite({
      slug: 'another-slug', quoraHandle: 'sam-example-1', quoraUrl: 'https://www.quora.com/profile/Sam-Example-1',
      name: 'Sam', title: 't', opening: 'o', bodyMarkdown: 'b', publishedOn: '2026-10-15', directoryProfileId: null, image: null,
      isPublic: false, blogUrl: null,
    });
    expect(result).toEqual({ status: 'handle_taken', slug: 'an-invitation-to-sam' });
    expect(queryDb).toHaveBeenCalledTimes(1);
  });
});
