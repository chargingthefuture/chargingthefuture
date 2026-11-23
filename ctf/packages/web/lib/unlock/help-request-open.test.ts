import { describe, expect, it } from 'vitest';
import { isUnlockHelpRequestOpen } from './help-request-open';

describe('a help request waiting on an admin', () => {
  const asked = { requestedAt: '2026-11-20T00:00:00.000Z', quoraHint: null, doneAt: null };

  it('waits until an admin marks it done or the address is approved or turned down', () => {
    expect(isUnlockHelpRequestOpen(asked, null)).toBe(true);
    expect(isUnlockHelpRequestOpen(asked, 'pending')).toBe(true);
    expect(isUnlockHelpRequestOpen({ ...asked, doneAt: '2026-11-21T00:00:00.000Z' }, null)).toBe(false);
    for (const status of ['approved', 'rejected', 'spam', 'duplicate']) expect(isUnlockHelpRequestOpen(asked, status)).toBe(false);
  });

  it('is not open for a member who never asked', () => {
    expect(isUnlockHelpRequestOpen(null, null)).toBe(false);
  });
});
