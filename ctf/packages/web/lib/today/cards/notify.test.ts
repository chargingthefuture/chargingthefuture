import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasMutedPost = vi.fn();
const notifySafe = vi.fn();
vi.mock('lib/mutes/repository', () => ({ hasMutedPost: (...args: unknown[]) => hasMutedPost(...args) }));
vi.mock('lib/notifications/repository', () => ({ notifySafe: (...args: unknown[]) => notifySafe(...args) }));
vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));

import { notifyOnCard } from './notify';

const input = { userId: 'acc_b', sourcePlugin: 'today', notificationType: 'today.card.pair_request', category: 'community' as const, summary: 'x', linkPath: '/' };

describe('notices from a card conversation', () => {
  beforeEach(() => {
    hasMutedPost.mockReset();
    notifySafe.mockReset();
  });

  it('tells a member who did not mute the card', async () => {
    hasMutedPost.mockResolvedValue(false);
    expect(await notifyOnCard('socket-relay:1', input)).toBe(true);
    expect(hasMutedPost).toHaveBeenCalledWith('acc_b', 'socket-relay:1');
    expect(notifySafe).toHaveBeenCalledWith(input);
  });

  it('tells nothing to a member who muted the card', async () => {
    hasMutedPost.mockResolvedValue(true);
    expect(await notifyOnCard('socket-relay:1', input)).toBe(false);
    expect(notifySafe).not.toHaveBeenCalled();
  });

  it('still tells the member when the mute list cannot be read', async () => {
    hasMutedPost.mockRejectedValue(new Error('down'));
    expect(await notifyOnCard('socket-relay:1', input)).toBe(true);
    expect(notifySafe).toHaveBeenCalled();
  });
});
