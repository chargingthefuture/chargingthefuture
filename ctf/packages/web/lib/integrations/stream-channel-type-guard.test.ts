import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));

import { ensureChannelTypeAcceptsSends, resetChannelTypeGuardForTests } from './stream-channel-type-guard';

// The app keeps "Mark Messages Pending" off through the Stream API, because with it on and the
// feature missing, Stream refuses every send (owner report, Beacon event chat).

function fakeClient(config: Record<string, unknown>) {
  return {
    getChannelType: vi.fn(async () => config),
    updateChannelType: vi.fn(async () => ({})),
  };
}

describe('ensureChannelTypeAcceptsSends', () => {
  beforeEach(() => resetChannelTypeGuardForTests());

  it('turns the setting off when it is on', async () => {
    const client = fakeClient({ mark_messages_pending: true });
    await expect(ensureChannelTypeAcceptsSends(client as never, 'key', 'livestream', 0)).resolves.toBe(true);
    expect(client.updateChannelType).toHaveBeenCalledWith('livestream', { mark_messages_pending: false });
  });

  it('changes nothing when the setting is already off', async () => {
    const client = fakeClient({ mark_messages_pending: false });
    await ensureChannelTypeAcceptsSends(client as never, 'key', 'livestream', 0);
    expect(client.updateChannelType).not.toHaveBeenCalled();
  });

  it('reads once an hour, not on every call', async () => {
    const client = fakeClient({});
    await ensureChannelTypeAcceptsSends(client as never, 'key', 'livestream', 0);
    await ensureChannelTypeAcceptsSends(client as never, 'key', 'livestream', 1000);
    expect(client.getChannelType).toHaveBeenCalledTimes(1);
    await ensureChannelTypeAcceptsSends(client as never, 'key', 'livestream', 60 * 60 * 1000 + 1);
    expect(client.getChannelType).toHaveBeenCalledTimes(2);
  });

  it('reports a failed read and returns false instead of throwing', async () => {
    const client = { getChannelType: vi.fn(async () => { throw new Error('down'); }), updateChannelType: vi.fn() };
    await expect(ensureChannelTypeAcceptsSends(client as never, 'key', 'livestream', 0)).resolves.toBe(false);
  });
});
