import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it, vi } from 'vitest';

// A card opened on signed-out Today: a story reads its post's Fireside comments (real, public, no
// demo schema); a sample ask or offer reads its conversation from the demo schema; nothing else opens.
const where = vi.hoisted(() => ({ store: null as AsyncLocalStorage<string> | null, reads: [] as string[] }));

vi.mock('lib/db/postgres', async () => {
  const { AsyncLocalStorage: Storage } = await import('node:async_hooks');
  where.store = new Storage<string>();
  return { runWithForcedPool: (target: string, fn: () => Promise<unknown>) => where.store!.run(target, fn) };
});
vi.mock('lib/identity/resolve-usernames', () => ({ resolveUsernames: async () => new Map([['u1', 'ana']]) }));
vi.mock('./story', () => ({
  storyPostFor: async (cardId: string) =>
    cardId.startsWith('blog-story:') ? { post: { repo: 'chargingthefuture', slug: cardId.slice(11) }, title: 'T' } : null,
}));
vi.mock('lib/fireside/card-thread', () => ({
  listCardThreadMessages: async () => {
    where.reads.push(`fireside:${where.store?.getStore() ?? 'public'}`);
    return [{ id: 'c1', authorId: 'u1', body: 'From the blog.', createdAt: new Date('2026-11-10T10:00:00Z'), editedAt: null }];
  },
}));
vi.mock('./repository', () => ({
  listGuestMessagesInStore: async () => {
    where.reads.push(`store:${where.store?.getStore() ?? 'public'}`);
    return [{ id: 'm1', authorId: 'dpsmp-01', body: 'Sample.', createdAt: new Date('2026-11-10T10:00:00Z'), editedAt: null, pairLow: null, pairHigh: null }];
  },
}));

import { guestOpens, readGuestConversation } from './public-read';

describe('a card opened on signed-out Today', () => {
  it('opens stories and the sample ask and offer cards only', () => {
    expect(guestOpens('blog-story:why')).toBe(true);
    expect(guestOpens('trust-transport:r1')).toBe(true);
    expect(guestOpens('skill-up:c1')).toBe(true);
    expect(guestOpens('peer-programming:g1')).toBe(false);
    expect(guestOpens('lighthouse:l1')).toBe(false);
  });

  it("shows a story's real Fireside comments, not sample data", async () => {
    where.reads.length = 0;
    const conversation = await readGuestConversation('blog-story:why');
    expect(where.reads).toEqual(['fireside:public']);
    expect(conversation).toMatchObject({ sample: false, messages: [{ id: 'c1', handle: 'ana', body: 'From the blog.' }] });
  });

  it('shows a sample card its conversation from the demo schema, marked sample', async () => {
    where.reads.length = 0;
    const conversation = await readGuestConversation('trust-transport:r1');
    expect(where.reads).toEqual(['store:demo']);
    expect(conversation.sample).toBe(true);
    expect(conversation.messages[0]).toMatchObject({ id: 'm1', body: 'Sample.' });
  });
});
