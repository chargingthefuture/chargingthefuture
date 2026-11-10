import { SE_CARD_LIFETIME_WORDS as W, SE_TODAY_RENEW_NOTICE, seRenewLink } from '@ctf/shared';
import { notifySafe } from 'lib/notifications/repository';
import { todayCardRule } from './lifetime';

// The day-14 notice on a poster's own ask or offer, in Activity: "Still need this? Keep it up for 14
// more days: <title>" ("Still offering this?" on an offer), with the renew in its link. Keyed by the
// card and the end of its window, so the daily run and the poster's own Today read never send it
// twice for one window (notifications dedupe on user, type and target_ref).

export type RenewNoticeInput = { ownerUserId: string; cardId: string; source: string; title: string; href: string; windowEndMs: number };

export function renewNoticeRef(cardId: string, windowEndMs: number): string {
  return `${cardId}@${new Date(windowEndMs).toISOString()}`;
}

export function sendRenewNotice(input: RenewNoticeInput): Promise<void> {
  const words = todayCardRule(input.source) === 'offer' ? W.offerNotice : W.askNotice;
  return notifySafe({
    userId: input.ownerUserId,
    sourcePlugin: 'today',
    notificationType: SE_TODAY_RENEW_NOTICE,
    category: 'activity',
    summary: `${words}: ${input.title}`,
    linkPath: seRenewLink(input.href, input.cardId),
    targetRef: renewNoticeRef(input.cardId, input.windowEndMs),
  });
}
