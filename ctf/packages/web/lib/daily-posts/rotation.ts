// The daily rotation: every post comes round once in each 30 days, so somebody who visits the
// Quora space on any day within 30 days of their first sees every post (owner request,
// 2026-11-02). Posts are dealt in number order into 30 daily slots, so a day carries the posts
// whose place in that order leaves the same remainder as the day. A new post takes the next place
// and moves nobody else's day. With 150 posts that is five a day.

export const ROTATION_DAYS = 30;

/** Day one of the rotation. Any fixed day would do; this is the day the screen was built. */
export const ROTATION_EPOCH = '2026-11-02';

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Days from the epoch to a date; negative before it. */
export function daysSinceEpoch(date: string): number {
  return daysBetween(ROTATION_EPOCH, date);
}

/** Which of the 30 days a calendar date is, 0 to 29. */
export function rotationSlot(date: string): number {
  const days = daysBetween(ROTATION_EPOCH, date);
  return ((days % ROTATION_DAYS) + ROTATION_DAYS) % ROTATION_DAYS;
}

/** The posts for a date, from a list already in number order. */
export function rotationFor<T>(postsInOrder: T[], date: string): T[] {
  const slot = rotationSlot(date);
  return postsInOrder.filter((_, index) => index % ROTATION_DAYS === slot);
}
