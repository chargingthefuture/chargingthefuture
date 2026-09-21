// Scheduled rooms, MVP (owner decision, 2026-09-19): what Chyme shows from the TI Radio guide.
//
// The guide's public route returns the entire week of 90-minute slots, booked or not. Chyme keeps
// only the booked ones that have not ended, soonest first, capped — the slot on air now comes first
// by construction — and prints them in the reader's own timezone. Pure functions, shared by the
// member view and the signed-out page; the Android app carries the same two in its ChymeApi.

const UPCOMING_LIMIT = 5;

// The slice of GET /api/ti-radio/guide this reads. Declared here rather than imported from
// lib/ti-radio (the plugin boundary). Anything else in the payload is ignored.
type GuideSlot = {
  slotStartIso: string;
  slotEndIso: string;
  isOnAir: boolean;
  booking: { title: string; hostUsername: string } | null;
};

export type ChymeUpcomingSlot = {
  slotStartIso: string;
  slotEndIso: string;
  isOnAir: boolean;
  title: string;
  hostUsername: string;
};

function isGuideSlot(value: unknown): value is GuideSlot {
  if (typeof value !== 'object' || value === null) return false;
  const slot = value as Record<string, unknown>;
  return typeof slot.slotStartIso === 'string' && typeof slot.slotEndIso === 'string';
}

// Booked slots that have not ended yet, soonest first, capped. A malformed entry is skipped rather
// than taking the entire list down.
export function pickUpcoming(slots: unknown[], now: Date, limit: number = UPCOMING_LIMIT): ChymeUpcomingSlot[] {
  const nowMs = now.getTime();
  const picked: ChymeUpcomingSlot[] = [];
  for (const raw of slots) {
    if (!isGuideSlot(raw) || !raw.booking) continue;
    if (Date.parse(raw.slotEndIso) <= nowMs) continue;
    picked.push({
      slotStartIso: raw.slotStartIso,
      slotEndIso: raw.slotEndIso,
      isOnAir: raw.isOnAir === true,
      title: raw.booking.title,
      hostUsername: raw.booking.hostUsername,
    });
    if (picked.length >= limit) break;
  }
  return picked;
}

// Printed in the reader's own timezone: a schedule people from many countries read has to say
// "9pm where you are". The guide does the same.
function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// "Today · 2:00 PM – 3:30 PM", "Tomorrow · …", or "Mon, Sep 21 · …".
export function formatUpcomingWhen(startIso: string, endIso: string, now: Date, tz: string = localTimeZone()): string {
  const start = new Date(startIso);
  const time = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
  const dayOf = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz });
  const today = dayOf(now);
  const tomorrow = dayOf(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const startDay = dayOf(start);
  const day =
    startDay === today
      ? 'Today'
      : startDay === tomorrow
        ? 'Tomorrow'
        : start.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${time(start)} – ${time(new Date(endIso))}`;
}
