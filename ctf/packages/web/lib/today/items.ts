import { closeGoal, getGoal } from 'lib/peer-programming/goals';
import { getRequestById as getRelayRequest } from 'lib/socket-relay/repository';
import { closeOpenRequestByOwner } from 'lib/socket-relay/close-open';
import { cancelOrder, getRequestById as getRideRequest } from 'lib/trust-transport/repository';
import { getPropertyById } from 'lib/lighthouse/repository';
import { getEventForToday } from 'lib/mutual-time/open-events';
import { todayCardRule } from './lifetime';

// The item behind an ask or offer card, read where it lives, for its poster's close and renew. Each
// is open while its own feature lists it on Today: a goal or request still open, a ride still waiting
// for a driver, a place to stay still listed, a Mutual Time survey still open for picking.

export type TodayItem = { ownerUserId: string; open: boolean; title: string; href: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function split(cardId: string): { source: string; id: string } | null {
  const at = cardId.indexOf(':');
  const source = cardId.slice(0, at);
  const id = cardId.slice(at + 1);
  return at > 0 && UUID.test(id) ? { source, id } : null;
}

type Reader = (id: string, viewerId: string) => Promise<TodayItem | null>;

const READERS: Record<string, Reader> = {
  'peer-programming': async (id) => {
    const goal = await getGoal(id);
    return goal ? { ownerUserId: goal.ownerUserId, open: goal.status === 'open', title: goal.title, href: '/apps/peer-programming' } : null;
  },
  'socket-relay': async (id) => {
    const request = await getRelayRequest(id);
    return request ? { ownerUserId: request.ownerUserId, open: request.status === 'open', title: request.title, href: '/apps/socket-relay' } : null;
  },
  'trust-transport': async (id) => {
    const request = await getRideRequest(id);
    return request ? { ownerUserId: request.requesterUserId, open: request.status === 'open', title: 'A ride is wanted', href: '/apps/trust-transport' } : null;
  },
  lighthouse: async (id, viewerId) => {
    const listing = await getPropertyById(id, { userId: viewerId, isAdmin: false });
    return listing ? { ownerUserId: listing.hostUserId, open: listing.isActive, title: listing.title, href: '/apps/lighthouse' } : null;
  },
  'mutual-time': async (id) => {
    const event = await getEventForToday(id);
    return event ? { ownerUserId: event.createdByUserId, open: event.open, title: event.title ?? 'Pick a time to meet', href: '/apps/mutual-time' } : null;
  },
};

// Null when the card is not an ask or offer, or its item is not there.
export async function readTodayItem(cardId: string, viewerId: string): Promise<TodayItem | null> {
  const parts = split(cardId);
  const read = parts ? READERS[parts.source] : undefined;
  if (!parts || !read) return null;
  return read(parts.id, viewerId);
}

export function closableSource(cardId: string): boolean {
  return todayCardRule(cardId.slice(0, cardId.indexOf(':'))) === 'ask';
}

// Close the ask where it lives: a goal is reached or withdrawn, a request closed or canceled, and a
// ride request canceled either way (the outcome is kept on Today's own row). False when it was no
// longer open.
export async function closeTodayItem(cardId: string, ownerUserId: string, done: boolean): Promise<boolean> {
  const parts = split(cardId);
  if (!parts) return false;
  if (parts.source === 'peer-programming') return closeGoal({ goalId: parts.id, ownerUserId, outcome: done ? 'reached' : 'withdrawn' });
  if (parts.source === 'socket-relay') return closeOpenRequestByOwner(parts.id, ownerUserId, done);
  if (parts.source === 'trust-transport') {
    await cancelOrder(parts.id, ownerUserId, false, null);
    return true;
  }
  return false;
}
