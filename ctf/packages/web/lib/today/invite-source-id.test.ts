import { describe, expect, it, vi } from 'vitest';

vi.mock('lib/directory/invites', () => ({ listLatestDirectoryInviteCards: vi.fn() }));
vi.mock('lib/feed/repository', () => ({}));
vi.mock('lib/what-works/repository', () => ({}));
vi.mock('lib/quora-deletion-survey/repository', () => ({}));

import { inviteSourceId } from './sources-stories';

// An invitation's Today card is keyed by its invite code, so the invitation's own page in the
// Directory opens the same conversation (owner decision, 2026-11-10).
describe('inviteSourceId', () => {
  it('takes the invite code from the invitation address', () => {
    expect(inviteSourceId('https://app.lagatos.com/apps/directory?invite=k3x9ab7qwe')).toBe('k3x9ab7qwe');
  });

  it('keeps the address for an invitation written before codes', () => {
    expect(inviteSourceId('https://app.lagatos.com/apps/directory')).toBe('https://app.lagatos.com/apps/directory');
    expect(inviteSourceId('not an address')).toBe('not an address');
  });
});
