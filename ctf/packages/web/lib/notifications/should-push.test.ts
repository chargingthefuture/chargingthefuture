import { describe, expect, it, vi } from 'vitest';

vi.mock('lib/db/postgres', () => ({ queryDb: vi.fn() }));
vi.mock('./push', () => ({ sendWebPushToUser: vi.fn() }));

import { shouldPushNow } from './repository';
import type { NotificationPreferences } from './types';

const base: NotificationPreferences = {
  pushSafety: false,
  pushActivity: false,
  pushCommunity: true,
  discreetPush: true,
  pushReplies: false,
  pushRooms: false,
  pushOther: true,
  quiet: null,
};
const reply = { category: 'community' as const, notificationType: 'commons.reply' };
const noon = new Date('2026-11-11T12:00:00Z');

describe('shouldPushNow', () => {
  it('follows the 3.1 rows on 3.1 and the categories on 3.0', () => {
    expect(shouldPushNow(reply, base, '3.1', noon)).toBe(false);
    expect(shouldPushNow(reply, base, '3.0', noon)).toBe(true);
    expect(shouldPushNow(reply, { ...base, pushReplies: true }, '3.1', noon)).toBe(true);
  });

  it('holds every ping in quiet hours', () => {
    const quiet = { startMinute: 11 * 60, endMinute: 13 * 60, timeZone: 'UTC' };
    expect(shouldPushNow(reply, { ...base, quiet }, '3.0', noon)).toBe(false);
    expect(shouldPushNow(reply, { ...base, pushReplies: true, quiet }, '3.1', noon)).toBe(false);
  });
});
