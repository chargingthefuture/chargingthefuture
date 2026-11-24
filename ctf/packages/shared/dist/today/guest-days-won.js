// Days won on signed-out Today (owner decision, 2026-11-16): the count is read from the demo schema
// and tagged Preview, and while the page is open it goes up by one at random intervals, with the
// emoji rain, so a visitor sees what a day won looks like. Nothing is written anywhere; the number
// shown is the sample total plus the ticks counted on this page. Signed-in Today ticks the same way
// only for an account on demo data (owner report, 2026-11-23), whose total is marked sample too;
// a real member's count never ticks.
export const SE_GUEST_TICK_MIN_MS = 20_000;
export const SE_GUEST_TICK_MAX_MS = 90_000;
// The wait before the next tick, from a random number in [0, 1).
export function seGuestTickDelayMs(random) {
    const share = Number.isFinite(random) ? Math.min(Math.max(random, 0), 1) : 0;
    return Math.round(SE_GUEST_TICK_MIN_MS + share * (SE_GUEST_TICK_MAX_MS - SE_GUEST_TICK_MIN_MS));
}
// The sample count with this page's ticks added, or null when there is no count to show.
export function seGuestDaysWon(daysWon, ticks) {
    if (!daysWon)
        return null;
    const added = Math.max(0, Math.floor(ticks));
    return { ...daysWon, total: daysWon.total + added, thisWeek: daysWon.thisWeek + added };
}
