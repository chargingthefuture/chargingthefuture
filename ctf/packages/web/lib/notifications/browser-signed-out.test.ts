import { describe, expect, it, vi } from 'vitest';

vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));

import { reportError } from 'lib/observability/report';
import { dropBrowserPushWhenSignedOut } from './browser-signed-out';

function fakeNav(subscription: { unsubscribe: () => Promise<boolean> } | null, registered = true) {
  return {
    serviceWorker: {
      getRegistration: vi.fn(async () =>
        registered ? { pushManager: { getSubscription: vi.fn(async () => subscription) } } : undefined,
      ),
    },
  } as unknown as Pick<Navigator, 'serviceWorker'>;
}

describe('dropBrowserPushWhenSignedOut', () => {
  it('cancels the browser subscription when one exists', async () => {
    const unsubscribe = vi.fn(async () => true);
    await expect(dropBrowserPushWhenSignedOut(fakeNav({ unsubscribe }))).resolves.toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a subscription, a registration or push support', async () => {
    await expect(dropBrowserPushWhenSignedOut(fakeNav(null))).resolves.toBe(false);
    await expect(dropBrowserPushWhenSignedOut(fakeNav(null, false))).resolves.toBe(false);
    await expect(dropBrowserPushWhenSignedOut({} as Pick<Navigator, 'serviceWorker'>)).resolves.toBe(false);
  });

  it('reports a failure and never throws', async () => {
    const unsubscribe = vi.fn(async () => {
      throw new Error('push service unreachable');
    });
    await expect(dropBrowserPushWhenSignedOut(fakeNav({ unsubscribe }))).resolves.toBe(false);
    expect(reportError).toHaveBeenCalled();
  });
});
