import { describe, expect, it, vi } from 'vitest';

vi.mock('lib/db/postgres', () => ({ queryDb: vi.fn() }));
vi.mock('lib/shared/unlock-interface', () => ({ listUnlockedUserIds: vi.fn() }));
vi.mock('./repository', () => ({}));

import { postRefFromUrl } from './card-thread';

// A story card finds its post's Fireside thread from the address posts.json gives it.
describe('postRefFromUrl', () => {
  it('reads the repository and slug from a blog article address', () => {
    expect(postRefFromUrl('https://chargingthefuture.github.io/chargingthefuture/article/chargingthefuture/why-i-trade')).toEqual({ repo: 'chargingthefuture', slug: 'why-i-trade' });
    expect(postRefFromUrl('https://chargingthefuture.github.io/chargingthefuture/article/quora/a%20b')).toEqual({ repo: 'quora', slug: 'a b' });
  });

  it('names no post for any other address', () => {
    expect(postRefFromUrl('https://example.org/article/x/y')).toBeNull();
    expect(postRefFromUrl('https://chargingthefuture.github.io/chargingthefuture/article/only-repo')).toBeNull();
  });
});
