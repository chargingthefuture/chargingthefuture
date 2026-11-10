import { SE_CARD_LIFETIME_WORDS as W, SE_TODAY_RENEW_NOTICE, seRenewLink, type SeTodayCard } from '@ctf/shared';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';
import type { TodayViewer } from './card';
import { mineFor, onToday, renewNoticeDue, todayCardRule, windowEndMs, type TodayCardWindow } from './lifetime';
import { readWindows } from './windows';

// Applies how long each card stays on Today (lifetime.ts) to one Today read: leaves out a card whose
// time is over, marks the viewer's own asks and offers with what they can do, and sends the day-14
// notice on the viewer's own (once per window: the notice is keyed by the window's end). Computed
// when Today is read, so no scheduled job is needed.

const hasWindow = (card: SeTodayCard) => ['ask', 'offer'].includes(todayCardRule(card.source));

async function windowsFor(cards: SeTodayCard[]): Promise<Map<string, TodayCardWindow>> {
  try {
    return await readWindows(cards.filter(hasWindow).map((card) => card.id));
  } catch (error) {
    // A failed read applies the default 14 days to every ask and offer rather than dropping them.
    reportError(error, { area: 'today', op: 'read_windows' });
    return new Map();
  }
}

function noticeFor(viewer: TodayViewer, card: SeTodayCard, window: TodayCardWindow | undefined) {
  const words = todayCardRule(card.source) === 'offer' ? W.offerNotice : W.askNotice;
  return notifySafe({
    userId: viewer.userId,
    sourcePlugin: 'today',
    notificationType: SE_TODAY_RENEW_NOTICE,
    category: 'activity',
    summary: `${words}: ${card.title}`,
    linkPath: seRenewLink(card.href, card.id),
    targetRef: `${card.id}@${new Date(windowEndMs(card, window)).toISOString()}`,
  });
}

// One card per id: the viewer's own copy (with `mine`) is kept over the copy other members see.
function oneEach(cards: SeTodayCard[], mineIds: Set<string>): SeTodayCard[] {
  const seen = new Set<string>();
  return [...cards.filter((card) => mineIds.has(card.id)), ...cards.filter((card) => !mineIds.has(card.id))].filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

export async function applyLifetimes(cards: SeTodayCard[], viewer: TodayViewer, mineIds: Set<string>, now: Date): Promise<SeTodayCard[]> {
  const unique = oneEach(cards, mineIds);
  const windows = await windowsFor(unique);
  const isMine = (card: SeTodayCard) => hasWindow(card) && (mineIds.has(card.id) || card.author?.accountId === viewer.userId);
  await Promise.all(
    unique.filter((card) => isMine(card) && renewNoticeDue(card, windows.get(card.id), now)).map((card) => noticeFor(viewer, card, windows.get(card.id))),
  );
  return unique
    .filter((card) => onToday(card, windows.get(card.id), now))
    .map((card) => (isMine(card) ? { ...card, mine: mineFor(card, windows.get(card.id)) } : card));
}
