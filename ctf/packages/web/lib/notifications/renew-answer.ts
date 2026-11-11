import type { NotificationAnswer } from './types';

// Whether a day-14 notice (`today.renew`) was already answered: its ask or offer was closed or kept
// up after the notice was sent, wherever the poster did it (Activity, the card, the item's own
// page). Read from today_card_windows when the feed is listed, so the one-tap keep-up never comes
// back on a notice that has been dealt with. A close wins over a keep-up.
export function renewNoticeAnswer(
  noticeAt: Date,
  window: { renewedAt: Date | null; closedAt: Date | null } | null,
): NotificationAnswer | null {
  if (!window) return null;
  if (window.closedAt && window.closedAt.getTime() >= noticeAt.getTime()) return 'closed';
  if (window.renewedAt && window.renewedAt.getTime() >= noticeAt.getTime()) return 'kept';
  return null;
}
