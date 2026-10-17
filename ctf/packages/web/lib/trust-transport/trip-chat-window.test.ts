import { describe, expect, it } from 'vitest';
import { tripChatAccess } from './trip-chat-window';

const now = new Date('2026-10-17T12:00:00.000Z');

describe('trip chat window (issue #2857)', () => {
  it('stays open while the trip is under way, or emergency-frozen', () => {
    expect(tripChatAccess({ status: 'en_route', completedAtIso: null, updatedAtIso: '2026-10-17T00:00:00.000Z' }, now).state).toBe('open');
    expect(tripChatAccess({ status: 'emergency_frozen', completedAtIso: null, updatedAtIso: '2026-10-17T00:00:00.000Z' }, now).state).toBe('open');
  });

  it('is read-only for 30 days after completion, from the completion time', () => {
    const access = tripChatAccess({ status: 'completed', completedAtIso: '2026-10-01T12:00:00.000Z', updatedAtIso: '2026-10-16T00:00:00.000Z' }, now);
    expect(access).toEqual({ state: 'read_only', closesAtIso: '2026-10-31T12:00:00.000Z' });
  });

  it('closes 30 days after a cancel', () => {
    const access = tripChatAccess({ status: 'canceled', completedAtIso: null, updatedAtIso: '2026-09-01T00:00:00.000Z' }, now);
    expect(access).toEqual({ state: 'closed', closedAtIso: '2026-10-01T00:00:00.000Z' });
  });

  it('stays read-only with no end while disputed', () => {
    expect(tripChatAccess({ status: 'disputed', completedAtIso: null, updatedAtIso: '2025-01-01T00:00:00.000Z' }, now)).toEqual({ state: 'read_only', closesAtIso: null });
  });
});
