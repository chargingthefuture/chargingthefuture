// Activity in 3.1, shared by web and Android (approved board "Activity"): what needs the member,
// then what happened today, then earlier, each with its full date and time in the reader's own
// timezone. Read from the app's notifications (GET /api/notifications). A notice that waits on the
// member carries its answer inline: confirm or decline a Recurring Activity invite, agree to a Just
// us two request on a Today card, or keep an ask or offer up 14 more days.

import type { SeCardKind, SeThemeTokens } from '../design/se-theme';
import { SE_CARD_LIFETIME_WORDS as L, seRenewCardId } from './lifetime';

export type SeActivityItem = {
  id: string;
  notificationType: string;
  summary: string;
  linkPath: string | null;
  // What the notice is about, as its producer recorded it: the activity id on a Recurring Activity
  // invite, `<card id>|<requester id>` on a Just us two request (seActivityPairRef).
  targetRef: string | null;
  // On a day-14 notice, decided on the server: kept up or closed after the notice was sent, so its
  // keep-up never comes back. Null on any other notice and on one still waiting.
  answer: 'kept' | 'closed' | null;
  isRead: boolean;
  createdAtIso: string;
};

export const SE_ACTIVITY_WORDS = {
  loading: 'Reading Activity…',
  needs: 'Needs you',
  today: 'Today',
  earlier: 'Earlier',
  empty: 'Nothing yet. Replies, credits sent to you and confirmations show here.',
  failed: 'Could not read Activity.',
  tryAgain: 'Try again',
  end: 'That is everything. Notifications are quiet unless you turn them up in Me.',
};

export const SE_RECURRING_INVITE_NOTICE = 'recurring-activity.invited';
export const SE_PAIR_REQUEST_NOTICE = 'today.card.pair_request';

// The target of a Just us two request notice: the card and the member who asked.
export function seActivityPairRef(cardId: string, requesterId: string): string {
  return `${cardId}|${requesterId}`;
}

function readPairRef(ref: string | null): { cardId: string; partnerId: string } | null {
  const at = ref ? ref.lastIndexOf('|') : -1;
  if (!ref || at <= 0 || at === ref.length - 1) return null;
  return { cardId: ref.slice(0, at), partnerId: ref.slice(at + 1) };
}

// One inline answer. `path` is the route it posts to; null only marks the notice read ("Not now").
// `look` follows the board: the filled button, the raised outline, or the quiet one beside them.
export type SeActivityButtonLook = 'primary' | 'raised' | 'quiet';

export type SeActivityButton = {
  label: string;
  busy: string;
  done: string;
  failed: string;
  look: SeActivityButtonLook;
  path: string | null;
  body: Record<string, string>;
};

export type SeActivityNeed = { item: SeActivityItem; partnerId: string | null; buttons: SeActivityButton[] };

const card = (cardId: string, path: string) => `/api/today/cards/${encodeURIComponent(cardId)}/${path}`;
const activity = (id: string, path: string) => `/api/recurring-activity/${encodeURIComponent(id)}/${path}`;

function recurringNeed(item: SeActivityItem): SeActivityNeed | null {
  if (!item.targetRef) return null;
  return {
    item,
    partnerId: null,
    buttons: [
      { label: 'Confirm', busy: 'Confirming…', done: 'Confirmed.', failed: 'Could not confirm it.', look: 'raised', path: activity(item.targetRef, 'confirm'), body: {} },
      { label: "That's not right", busy: 'Sending…', done: 'Declined. It will not be counted.', failed: 'Could not decline it.', look: 'quiet', path: activity(item.targetRef, 'decline'), body: {} },
    ],
  };
}

function pairNeed(item: SeActivityItem): SeActivityNeed | null {
  const ref = readPairRef(item.targetRef);
  if (!ref) return null;
  return {
    item,
    partnerId: ref.partnerId,
    buttons: [
      {
        label: 'Agree',
        busy: 'Agreeing…',
        done: 'Agreed. Open the card in Today to talk just you two.',
        failed: 'Could not agree.',
        look: 'primary',
        path: card(ref.cardId, 'pair/agree'),
        body: { partnerId: ref.partnerId },
      },
      { label: 'Not now', busy: 'Not now', done: '', failed: '', look: 'quiet', path: null, body: {} },
    ],
  };
}

function renewNeed(item: SeActivityItem): SeActivityNeed | null {
  const cardId = seRenewCardId(item);
  if (!cardId) return null;
  return { item, partnerId: null, buttons: [{ label: L.renew, busy: L.renewing, done: L.renewed, failed: L.renewFailed, look: 'raised', path: card(cardId, 'renew'), body: {} }] };
}

// The inline answer an unread notice waits on, or null for a notice that only tells.
export function seActivityNeed(item: SeActivityItem): SeActivityNeed | null {
  if (item.isRead || item.answer) return null;
  if (item.notificationType === SE_RECURRING_INVITE_NOTICE) return recurringNeed(item);
  if (item.notificationType === SE_PAIR_REQUEST_NOTICE) return pairNeed(item);
  return renewNeed(item);
}

// The line under a day-14 notice that was already answered: "Kept up on Today for 14 more days." or
// "Closed. It has left Today."; null otherwise.
export function seActivityOutcome(item: SeActivityItem): string | null {
  if (item.answer === 'kept') return L.renewed;
  if (item.answer === 'closed') return L.closed;
  return null;
}

export type SeActivityView = { needs: SeActivityNeed[]; today: SeActivityItem[]; earlier: SeActivityItem[] };

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Newest first. A notice waiting on the member is in Needs you; the rest split into today (the
// reader's own calendar day) and earlier.
export function seActivityView(items: readonly SeActivityItem[], now: Date = new Date()): SeActivityView {
  const sorted = [...items].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  const view: SeActivityView = { needs: [], today: [], earlier: [] };
  for (const item of sorted) {
    const need = seActivityNeed(item);
    if (need) view.needs.push(need);
    else if (sameLocalDay(new Date(item.createdAtIso), now)) view.today.push(item);
    else view.earlier.push(item);
  }
  return view;
}

// "October 26, 2026 at 1:12 PM CDT", in the reader's own timezone.
export function seActivityWhen(iso: string): string {
  const at = new Date(iso);
  const date = at.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return `${date} at ${time}`;
}

// The row icon for each kind of notice, drawn on a 24-unit grid, with the card kind its circle
// takes its tint from: a reply or message, something done or sent, something dated, and a thing
// that helped somebody.
export type SeActivityIcon = 'reply' | 'check' | 'calendar' | 'star';

export const SE_ACTIVITY_ICON_PATHS: Record<SeActivityIcon, string> = {
  reply: 'M4 5h16v11H8l-4 4z',
  check: 'M5 12l5 5 9-10',
  calendar: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
  star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.4 9.3l6-.7z',
};

export const SE_ACTIVITY_ICON_KIND: Record<SeActivityIcon, SeCardKind> = { reply: 'ask', check: 'offer', calendar: 'match', star: 'story' };

const CHECK_TYPES: readonly string[] = [
  'service-credits.received',
  'recurring-activity.confirmed',
  'peer-programming.goal.task-finished',
  'skill-up.milestone.released',
  'socket-relay.request.claimed',
  'trust-transport.offer.accepted',
];
const CALENDAR_TYPES: readonly string[] = [SE_RECURRING_INVITE_NOTICE, 'recurring-activity.declined', 'today.renew'];
const STAR_TYPES: readonly string[] = ['comic.answer.published'];

export function seActivityIcon(notificationType: string): SeActivityIcon {
  if (CHECK_TYPES.includes(notificationType)) return 'check';
  if (CALENDAR_TYPES.includes(notificationType)) return 'calendar';
  if (STAR_TYPES.includes(notificationType)) return 'star';
  return 'reply';
}

function mixHex(a: string, b: string, share: number): string {
  const channel = (hex: string, i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(channel(a, i) * share + channel(b, i) * (1 - share)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// The icon circle: the kind's color, lightly, over the card color, so it reads in all four colors
// and both modes.
export function seActivityTint(t: SeThemeTokens, icon: SeActivityIcon): string {
  return mixHex(t.kind[SE_ACTIVITY_ICON_KIND[icon]], t.card, 0.2);
}

// "Just now", "5 min ago", "3 h ago", "2 days ago", then the date. Used beside messages on a card
// and in the Architect's answers; Activity itself shows the full date and time.
export function seAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
