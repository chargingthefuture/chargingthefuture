import { describe, expect, it } from 'vitest';
import { isUnlockHelpRequestOpen, openUnlockHelpRequests, unlockHelpRequestsHeadline } from './help-request-open';

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

describe('the help requests listed at the top of /admin/unlock', () => {
  const row = (userId: string, helpRequestedAt: string | null, helpRequestOpen: boolean) => ({ userId, helpRequestedAt, helpRequestOpen });

  it('keeps only open requests, oldest first', () => {
    const rows = [
      row('late', '2026-11-20T10:00:00.000Z', true),
      row('done', '2026-11-01T10:00:00.000Z', false),
      row('none', null, false),
      row('early', '2026-11-10T10:00:00.000Z', true),
    ];
    expect(openUnlockHelpRequests(rows).map((r) => r.userId)).toEqual(['early', 'late']);
  });

  it('lists nobody when nothing waits', () => {
    expect(openUnlockHelpRequests([row('a', null, false)])).toEqual([]);
  });

  it('says one person or several', () => {
    expect(unlockHelpRequestsHeadline(1)).toBe('1 person asked for help');
    expect(unlockHelpRequestsHeadline(2)).toBe('2 people asked for help');
  });
});
