import type { TrustTransportTrip } from './types';

// When a trip's chat stops taking new messages, and when it stops opening (owner decision, 2026-10-17;
// issue #2857). Rule 100 binds the 1:1 trip chat to one trip: it is not a lasting direct line between
// two people who were matched for one ride.
//
//   - A trip still under way: open.
//   - Completed or canceled: read-only for TRIP_CHAT_READ_ONLY_DAYS from the day it ended, then closed
//     for both members. The messages stay stored as moderation and abuse evidence either way.
//   - Disputed: read-only with no end date while the dispute is open, because the conversation may be
//     the evidence. Resolving it moves the trip to completed or canceled, which starts the window.
//   - Emergency-frozen is not an end state (it moves on to disputed or canceled), so it stays open.

export const TRIP_CHAT_READ_ONLY_DAYS = 30;

export type TripChatAccess =
  | { state: 'open' }
  | { state: 'read_only'; closesAtIso: string | null }
  | { state: 'closed'; closedAtIso: string };

type TripTiming = Pick<TrustTransportTrip, 'status' | 'completedAtIso' | 'updatedAtIso'>;

export function tripEnded(status: TrustTransportTrip['status']): boolean {
  return status === 'completed' || status === 'canceled' || status === 'disputed';
}

export function tripChatAccess(trip: TripTiming, now: Date = new Date()): TripChatAccess {
  if (trip.status === 'disputed') return { state: 'read_only', closesAtIso: null };
  if (trip.status !== 'completed' && trip.status !== 'canceled') return { state: 'open' };

  const endedAtIso = (trip.status === 'completed' ? trip.completedAtIso : null) ?? trip.updatedAtIso;
  const closesAt = new Date(new Date(endedAtIso).getTime() + TRIP_CHAT_READ_ONLY_DAYS * 24 * 60 * 60 * 1000);
  if (now.getTime() >= closesAt.getTime()) return { state: 'closed', closedAtIso: closesAt.toISOString() };
  return { state: 'read_only', closesAtIso: closesAt.toISOString() };
}
