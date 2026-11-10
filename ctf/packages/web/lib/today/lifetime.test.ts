import { describe, expect, it } from 'vitest';
import { seAskDueIso, seMarksFromSaved, seRenewCardId, seRenewLink, seToggleRead, seTodayView, type SeToday, type SeTodayCard } from '@ctf/shared';
import { mineFor, onToday, readDueIso, renewNoticeDue, renewedUntil, todayCardRule, type TodayCardWindow } from './lifetime';

const DAY = 86_400_000;
const NOW = new Date('2026-11-03T12:00:00.000Z');

function cardOf(source: string, daysAgo: number, kind: SeTodayCard['kind'] = 'ask'): SeTodayCard {
  return {
    id: `${source}:x`,
    kind,
    source,
    label: 'L',
    title: 'T',
    body: null,
    author: null,
    createdAtIso: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
    href: '/apps/socket-relay',
    actions: [],
  };
}

const win = (over: Partial<TodayCardWindow>): TodayCardWindow => ({ ownerUserId: 'u1', dueIso: null, shownUntilIso: null, outcome: null, ...over });

describe('which rule a card follows', () => {
  it('names asks, offers, cards kept on their own schedule, and the 7-day rest', () => {
    expect(['peer-programming', 'socket-relay', 'trust-transport'].map(todayCardRule)).toEqual(['ask', 'ask', 'ask']);
    expect(todayCardRule('lighthouse')).toBe('offer');
    expect(todayCardRule('skill-up')).toBe('kept');
    expect(todayCardRule('announcement')).toBe('week');
    expect(todayCardRule('beacon-replay')).toBe('week');
  });
});

describe('an ask with no deadline', () => {
  it('stays 14 days from posting, then leaves', () => {
    expect(onToday(cardOf('socket-relay', 13.9), undefined, NOW)).toBe(true);
    expect(onToday(cardOf('socket-relay', 14.1), undefined, NOW)).toBe(false);
  });

  it('gets the notice on day 14, and not before', () => {
    expect(renewNoticeDue(cardOf('socket-relay', 12.5), undefined, NOW)).toBe(false);
    expect(renewNoticeDue(cardOf('socket-relay', 13.5), undefined, NOW)).toBe(true);
  });

  it('comes back for 14 days from the renew tap', () => {
    const until = renewedUntil(NOW).toISOString();
    expect(until).toBe(new Date(NOW.getTime() + 14 * DAY).toISOString());
    expect(onToday(cardOf('socket-relay', 20), win({ shownUntilIso: until }), NOW)).toBe(true);
    expect(onToday(cardOf('socket-relay', 20), win({ shownUntilIso: until }), new Date(NOW.getTime() + 14.1 * DAY))).toBe(false);
  });

  it('leaves once its poster closed it', () => {
    expect(onToday(cardOf('socket-relay', 1), win({ outcome: 'not_done' }), NOW)).toBe(false);
  });
});

describe('an ask with a deadline', () => {
  it('stays until the deadline, even past 14 days, and gets no renew', () => {
    const due = new Date(NOW.getTime() + 2 * DAY).toISOString();
    expect(onToday(cardOf('socket-relay', 20), win({ dueIso: due }), NOW)).toBe(true);
    expect(onToday(cardOf('socket-relay', 1), win({ dueIso: due }), new Date(NOW.getTime() + 3 * DAY))).toBe(false);
    expect(renewNoticeDue(cardOf('socket-relay', 13.5), win({ dueIso: due }), NOW)).toBe(false);
    expect(mineFor(cardOf('socket-relay', 1), win({ dueIso: due }))).toEqual({ leavesIso: due, dueIso: due, canClose: true, canRenew: false });
  });

  it('accepts a deadline from now up to a year ahead only', () => {
    expect(readDueIso(new Date(NOW.getTime() + DAY).toISOString(), NOW)).not.toBeNull();
    expect(readDueIso(new Date(NOW.getTime() - DAY).toISOString(), NOW)).toBeNull();
    expect(readDueIso(new Date(NOW.getTime() + 400 * DAY).toISOString(), NOW)).toBeNull();
    expect(readDueIso('soon', NOW)).toBeNull();
  });
});

describe('the other cards', () => {
  it('keeps an offer 14 days with a renew and no close', () => {
    expect(onToday(cardOf('lighthouse', 13, 'offer'), undefined, NOW)).toBe(true);
    expect(onToday(cardOf('lighthouse', 15, 'offer'), undefined, NOW)).toBe(false);
    expect(mineFor(cardOf('lighthouse', 1, 'offer'), undefined).canClose).toBe(false);
  });

  it('shows a story 7 days from posting', () => {
    expect(onToday(cardOf('announcement', 6.9, 'story'), undefined, NOW)).toBe(true);
    expect(onToday(cardOf('directory-invite', 7.1, 'story'), undefined, NOW)).toBe(false);
    expect(renewNoticeDue(cardOf('announcement', 20, 'story'), undefined, NOW)).toBe(false);
  });

  it('keeps a Skill Up cohort while its source lists it, with no window and no notice', () => {
    expect(onToday(cardOf('skill-up', 60, 'offer'), undefined, NOW)).toBe(true);
    expect(renewNoticeDue(cardOf('skill-up', 60, 'offer'), undefined, NOW)).toBe(false);
  });

  it('keeps a daily card, dated to the start of today', () => {
    expect(onToday(cardOf('blog-story', 0.4, 'story'), undefined, NOW)).toBe(true);
  });
});

describe('the deadline chosen in + New', () => {
  const at = new Date(2026, 10, 4, 10, 0); // a Wednesday, local time

  it('means the end of the local day, the coming Sunday, or the date picked', () => {
    expect(new Date(seAskDueIso('today', null, at) as string).getDate()).toBe(4);
    const sunday = new Date(seAskDueIso('week', null, at) as string);
    expect([sunday.getDay(), sunday.getDate(), sunday.getHours()]).toEqual([0, 8, 23]);
    expect(new Date(seAskDueIso('date', '2026-11-20', at) as string).getDate()).toBe(20);
  });

  it('is no deadline for none, a missing date, or a date already over', () => {
    expect(seAskDueIso('none', null, at)).toBeNull();
    expect(seAskDueIso('date', null, at)).toBeNull();
    expect(seAskDueIso('date', '2026-11-01', at)).toBeNull();
  });
});

describe('the day-14 notice link', () => {
  it('carries the card id it renews', () => {
    const linkPath = seRenewLink('/apps/socket-relay', 'socket-relay:abc');
    expect(seRenewCardId({ notificationType: 'today.renew', linkPath })).toBe('socket-relay:abc');
    expect(seRenewCardId({ notificationType: 'commons.reply', linkPath })).toBeNull();
  });
});

describe('a card marked done on the device', () => {
  const today: SeToday = {
    generatedAtIso: NOW.toISOString(),
    presence: null,
    daysWon: null,
    broadcast: null,
    rooms: [],
    week: [],
    cards: [{ ...cardOf('socket-relay', 1), id: 'a' }, { ...cardOf('socket-relay', 1), id: 'b', done: true }],
    unavailable: [],
  };

  it('stays the day it was marked and leaves from the next day', () => {
    const marks = seToggleRead({ read: [], hidden: [] }, 'a', '2026-11-03');
    expect(seTodayView(today, marks, 'all', '2026-11-03').cards.map((c) => c.id)).toEqual(['a', 'b']);
    expect(seTodayView(today, marks, 'all', '2026-11-04').cards.map((c) => c.id)).toEqual(['b']);
  });

  it('counts an old mark with no day as marked today', () => {
    const marks = seMarksFromSaved({ read: ['a'], hidden: [] }, '2026-11-03');
    expect(marks.readOn).toEqual({ a: '2026-11-03' });
    expect(seTodayView(today, marks, 'all', '2026-11-03').cards).toHaveLength(2);
  });

  it('keeps a card the server marked done, as before', () => {
    const marks = { read: ['b'], hidden: [], readOn: { b: '2026-11-01' } };
    expect(seTodayView(today, marks, 'all', '2026-11-03').cards.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('unmarking clears the day', () => {
    const marked = seToggleRead({ read: [], hidden: [] }, 'a', '2026-11-03');
    expect(seToggleRead(marked, 'a', '2026-11-03')).toEqual({ read: [], hidden: [], readOn: {} });
  });
});
