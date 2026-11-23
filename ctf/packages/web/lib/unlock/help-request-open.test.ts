import { describe, expect, it } from 'vitest';
import { isUnlockHelpRequestOpen, unlockHelpRequestOpenedRef } from './help-request-open';

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

describe('which press of "ask for help" tells the admins', () => {
  const requestedAt = new Date('2026-11-20T10:00:00Z');
  const doneAt = new Date('2026-11-21T09:00:00Z');

  it('tells them on the first press', () => {
    expect(unlockHelpRequestOpenedRef({ inserted: true, requested_at: requestedAt, done_at: null, prev_done_at: null })).toBe(
      'help@2026-11-20T10:00:00.000Z',
    );
  });

  it('stays quiet on a repeat press of a request already open', () => {
    expect(unlockHelpRequestOpenedRef({ inserted: false, requested_at: requestedAt, done_at: null, prev_done_at: null })).toBeNull();
  });

  it('stays quiet when a request marked done is pressed again with nothing new', () => {
    expect(unlockHelpRequestOpenedRef({ inserted: false, requested_at: requestedAt, done_at: doneAt, prev_done_at: doneAt })).toBeNull();
  });

  it('tells them again when a request marked done reopens with something new', () => {
    expect(unlockHelpRequestOpenedRef({ inserted: false, requested_at: requestedAt, done_at: null, prev_done_at: doneAt })).toBe(
      'help@2026-11-20T10:00:00.000Z/reopened@2026-11-21T09:00:00.000Z',
    );
  });
});
