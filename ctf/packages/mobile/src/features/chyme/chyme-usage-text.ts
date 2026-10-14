// Labels and the plain-text copy for the live audio usage screen, copied from the web
// (web components/chyme/chyme-stream-usage-shell.tsx).

import type { UsageDay, UsagePayload } from './chyme-admin-api';

type Band = UsagePayload['usage']['band'];

export const BAND_LABEL: Record<Band, string> = {
  green: 'Green — under 70% used',
  yellow: 'Yellow — 70% to 85% used',
  orange: 'Orange — 85% to 95% used',
  red: 'Red — 95% or more used',
};

export const BAND_COLOR: Record<Band, string> = {
  green: '#22C55E',
  yellow: '#EAB308',
  orange: '#F97316',
  red: '#EF4444',
};

export const ONE_PERSON_ALL_DAY_MINUTES = 24 * 60;

const SURFACE_LABEL: Record<string, string> = {
  'chyme:chyme-main-room': 'Chyme main room (members)',
  'chyme:chyme-contributors-room': 'Chyme Weavers room (members)',
  'chyme:guest': 'Chyme signed-out listeners',
  'chyme:back-channel': 'Chyme Back Channel calls',
  beacon: 'Beacon broadcasts (publishers)',
  'peer-programming': 'PeerProgramming cohort calls',
  foundation: 'Foundation calls',
  other: 'Other calls',
};

export function surfaceLabel(surface: string): string {
  return SURFACE_LABEL[surface] ?? surface;
}

// The web's toLocaleString('en-US'): thousands separated by commas.
export function formatMinutes(minutes: number): string {
  return String(minutes).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export const DAY_RANGES = ['7', '30', 'month', 'all'] as const;
export type DayRange = (typeof DAY_RANGES)[number];

export const DAY_RANGE_PILL: Record<DayRange, string> = { '7': '7 days', '30': '30 days', month: 'This month', all: 'All of it' };

export const DAY_RANGE_TITLE: Record<DayRange, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  month: 'This month, day by day',
  all: 'Every day recorded',
};

export function daysInRange(usage: UsagePayload['usage'], range: DayRange): UsageDay[] {
  if (range === '7') return usage.byDay.slice(-7);
  if (range === '30') return usage.byDay.slice(-30);
  if (range === 'month') return usage.byDay.filter((day) => day.dateIso >= usage.monthStartIso);
  return usage.byDay;
}

export function monthShare(payload: UsagePayload): number {
  return Math.round((ONE_PERSON_ALL_DAY_MINUTES * payload.usage.daysInMonth * 100) / payload.config.budgetMinutes);
}

export function asPlainText(payload: UsagePayload, range: DayRange): string {
  const { usage, policy, room, config } = payload;
  const surfaces = usage.bySurface.length === 0
    ? ['  (nothing recorded yet)']
    : usage.bySurface.map((row) => `  ${surfaceLabel(row.surface)}: ${formatMinutes(row.minutes)} minutes`);
  return [
    `Chyme live audio — Stream Video minutes, ${usage.monthStartIso} to ${usage.todayIso} (day ${usage.daysElapsed} of ${usage.daysInMonth})`,
    `Used: ${formatMinutes(usage.usedMinutes)} of ${formatMinutes(usage.budgetMinutes)} participant-minutes (${usage.percentUsed}%)`,
    `Band: ${BAND_LABEL[usage.band]}`,
    `Today so far: ${formatMinutes(usage.todayMinutes)} minutes`,
    `At this month's daily average the month ends at about ${formatMinutes(usage.projectedMonthMinutes)} minutes (${usage.projectedPercent}%)`,
    '',
    'Right now:',
    `  ${room.roomName}: ${room.isLive ? 'live' : 'not live'} — ${room.participantCount} member(s), ${room.guestCount} signed-out listener(s)`,
    `  Room cap in force: ${policy.memberCap} members; guest cap: ${policy.guestCap}`,
    `  Listening without an account: ${policy.guestListenAllowed ? 'open' : 'paused'}; Back Channel: ${policy.backChannelAllowed ? 'open' : 'paused'}`,
    '',
    'This month by surface:',
    ...surfaces,
    '',
    `${DAY_RANGE_TITLE[range]}:`,
    ...daysInRange(usage, range).map((day) => `  ${day.dateIso}: ${formatMinutes(day.minutes)} minutes`),
    '',
    `Settings: budget ${formatMinutes(config.budgetMinutes)} minutes (STREAM_VIDEO_MINUTES_BUDGET); room cap ${config.maxParticipants} (CHYME_MAX_PARTICIPANTS); guest cap ${config.maxGuestListeners} (CHYME_MAX_GUEST_LISTENERS); Red-band room cap ${config.redBandMaxParticipants} (CHYME_RED_BAND_MAX_PARTICIPANTS)`,
    `One person in the room all day costs ${formatMinutes(ONE_PERSON_ALL_DAY_MINUTES)} minutes; all month, about ${monthShare(payload)}% of the budget.`,
    '',
    'The count is the app’s own estimate from the presence heartbeats. The Stream dashboard is the bill of record.',
  ].join('\n');
}
