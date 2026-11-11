// The 3.1 Settings and Theme screens, shared by web and Android, built to the approved boards
// "Settings" and "Theme". Every choice here is saved on the account (user_ui_preferences and
// notification_preferences); nothing is kept only on the device.

import { SE_DEFAULT_THEME, SE_THEME_COLORS, type SeThemeColor, type SeThemeTokens } from './se-theme';

// ---- Look and reading ----

export type SeTextSize = 'default' | 'large' | 'larger';
export const SE_TEXT_SIZES: readonly SeTextSize[] = ['default', 'large', 'larger'];
export const SE_TEXT_SIZE_LABELS: Record<SeTextSize, string> = { default: 'Default', large: 'Large', larger: 'Larger' };
// How much larger the screen is drawn: the web zooms the screen, Android scales it the same amount.
export const SE_TEXT_SIZE_SCALE: Record<SeTextSize, number> = { default: 1, large: 1.15, larger: 1.3 };

export function isSeTextSize(value: unknown): value is SeTextSize {
  return typeof value === 'string' && (SE_TEXT_SIZES as readonly string[]).includes(value);
}

export type SeReadingPrefs = { textSize: SeTextSize; highContrast: boolean; readableFont: boolean; emojiRain: boolean };
export const SE_DEFAULT_READING: SeReadingPrefs = { textSize: 'default', highContrast: false, readableFont: false, emojiRain: false };
export type SeReadingSwitch = 'highContrast' | 'readableFont' | 'emojiRain';

// Higher contrast: the soft grey text is drawn in the full text color and the faint card borders
// in the strong line color, in every color and mode.
export function seReadableTokens(t: SeThemeTokens, highContrast: boolean): SeThemeTokens {
  return highContrast ? { ...t, soft: t.ink, hair: t.line } : t;
}

// The font for "Easier-to-read font": Atkinson Hyperlegible, self-hosted on the web and bundled in
// the Android app.
export const SE_READABLE_FONT = 'Atkinson Hyperlegible';

// ---- Notifications ----

export type SeNotifyGroup = 'replies' | 'rooms' | 'other';
export const SE_NOTIFY_GROUPS: readonly SeNotifyGroup[] = ['replies', 'rooms', 'other'];
export const SE_NOTIFY_GROUP_LABELS: Record<SeNotifyGroup, string> = {
  replies: 'Replies and talk requests',
  rooms: 'Rooms starting',
  other: 'Everything else',
};

const REPLY_TYPES = new Set([
  'commons.reply',
  'commons.mention',
  'commons.announcement_reply',
  'fireside.reply',
  'today.card.pair_request',
  'today.card.pair_message',
  'questions.match.message',
  'peer-programming.cohort.message',
]);

// Which Settings row a notification type belongs to. A room or talk that starts comes from Chyme,
// Beacon or TI Radio; replies and requests to talk are the listed types; the rest is "Everything
// else".
export function seNotifyGroup(notificationType: string): SeNotifyGroup {
  if (REPLY_TYPES.has(notificationType)) return 'replies';
  if (/^(chyme|beacon|ti-radio)\./.test(notificationType)) return 'rooms';
  return 'other';
}

// Quiet hours, as minutes after midnight in the member's own time zone. Start after end wraps past
// midnight (10:00 PM to 7:00 AM).
export type SeQuietHours = { startMinute: number; endMinute: number; timeZone: string };
export type SeNotifyPrefs = Record<SeNotifyGroup, boolean> & { quiet: SeQuietHours | null };
export const SE_DEFAULT_QUIET: Omit<SeQuietHours, 'timeZone'> = { startMinute: 22 * 60, endMinute: 7 * 60 };

export function isSeMinuteOfDay(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1440;
}

export function seInQuietMinute(minute: number, startMinute: number, endMinute: number): boolean {
  if (startMinute === endMinute) return false;
  if (startMinute < endMinute) return minute >= startMinute && minute < endMinute;
  return minute >= startMinute || minute < endMinute;
}

// The minute of the day a moment falls on in a time zone; an unknown zone reads as UTC.
export function seMinuteInZone(at: Date, timeZone: string): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  } catch {
    return at.getUTCHours() * 60 + at.getUTCMinutes();
  }
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return (read('hour') % 24) * 60 + read('minute');
}

export function seInQuietHours(quiet: SeQuietHours | null, at: Date): boolean {
  if (!quiet) return false;
  return seInQuietMinute(seMinuteInZone(at, quiet.timeZone), quiet.startMinute, quiet.endMinute);
}

// "10:00 PM" for 1320.
export function seClockLabel(minute: number): string {
  const hour = Math.floor(minute / 60);
  const mins = String(minute % 60).padStart(2, '0');
  return `${hour % 12 === 0 ? 12 : hour % 12}:${mins} ${hour < 12 ? 'AM' : 'PM'}`;
}

// "22:00" for 1320, the value of a time field; and back.
export function seClockValue(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function seParseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const minute = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[1]) < 24 && Number(match[2]) < 60 ? minute : null;
}

// ---- Theme screen ----

// The four colors, the default first, each with its note: where else the color is used.
const THEME_NOTES: Record<SeThemeColor, string> = {
  forest: 'One Percent',
  burgundy: 'The landing page',
  coral: 'The blog',
  'teal-purple': 'The first wallpaper',
};

export function seThemeNote(color: SeThemeColor): string {
  return color === SE_DEFAULT_THEME.color ? `Default · ${THEME_NOTES[color]}` : THEME_NOTES[color];
}

export const SE_THEME_ORDER: readonly SeThemeColor[] = [
  SE_DEFAULT_THEME.color,
  ...SE_THEME_COLORS.filter((color) => color !== SE_DEFAULT_THEME.color),
];

// ---- Words ----

export const SE_SETTINGS_WORDS = {
  title: 'Settings',
  backToMe: 'Back to Me',
  backToSettings: 'Back to Settings',
  on: 'On',
  off: 'Off',
  notifications: 'Notifications',
  quietHours: 'Quiet hours',
  quietFrom: 'From',
  quietTo: 'To',
  quietSave: 'Save quiet hours',
  quietOff: 'Turn quiet hours off',
  quietRange: (start: number, end: number) => `${seClockLabel(start)} to ${seClockLabel(end)}`,
  look: 'Look and reading',
  theme: 'Theme',
  textSize: 'Text size',
  highContrast: 'Higher contrast',
  readableFont: 'Easier-to-read font',
  emojiRain: 'Emoji rain when Days won goes up',
  safety: 'Safety and privacy',
  blocked: 'Blocked people',
  muted: 'Muted people and words',
  census: 'Quora census',
  censusAdded: 'Added',
  censusNotAdded: 'Not added',
  help: 'Help',
  architect: 'Ask the architect',
  bug: 'Report a bug',
  guide: 'Guide and community rules',
  guideLink: 'Guide',
  rulesLink: 'Community rules',
  terms: 'Terms and privacy',
  get: 'Get',
  wallpapers: 'Wallpapers',
  androidApp: 'Get the Android app',
  data: 'Your data',
  deletePart: 'Delete data from one part of the app',
  deleteAccount: 'Delete your account',
  version: 'You are using 3.1. You can go back to 3.0 at any time.',
  backTo30: 'Back to 3.0',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  signOutConfirm: 'Sign out of this device?',
  signOutConfirmText: 'You can sign back in at any time.',
  signOutFailed: 'Signing out failed. Reload and try again.',
  readFailed: 'Could not read your settings this time.',
  saveFailed: 'Could not save that setting.',
  dark: 'Dark',
  light: 'Light',
  lightOrDark: 'Light or dark',
  sameColors: 'The same colors as the wallpapers',
  wallpapersIn: 'Wallpapers in these colors',
} as const;

// The Quora census card in Today (approved board "Settings", top card).
export const SE_CENSUS_WORDS = {
  label: 'Quora census',
  title: 'Lost a Quora account? Add it to the census',
  body: 'One card per account Quora removed: the notice it sent and the account you still hold. You choose what may be used.',
  add: 'Add an account',
  notForMe: 'Not for me',
} as const;

// Each color's swatch on the Theme screen, as drawn on the board: a background and two dots.
export const SE_THEME_SWATCHES: Record<SeThemeColor, { bg: string; a: string; b: string }> = {
  forest: { bg: '#1f4a37', a: '#e3b74f', b: '#f6efe8' },
  burgundy: { bg: '#6b1f2e', a: '#f2c46d', b: '#f6efe8' },
  coral: { bg: '#2a1a1d', a: '#f0a39a', b: '#f6efe8' },
  'teal-purple': { bg: '#0f0e17', a: '#3fb8af', b: '#8a63d2' },
};
