// What the 3.1 Me screen shows, shared by web and Android, built to the approved board "Me": the
// member's name, since when, badges and three profile prompts; ServiceCredits; Saved, Read and
// Hidden; the Tools grid; and the gear to Settings. Making things is + New and reading is Today.

import { SE_DEFAULT_THEME, isSeThemeColor, isSeThemeMode, type SeCardKind, type SeThemeColor, type SeThemeMode } from './se-theme';

const RELEASES = 'https://github.com/chargingthefuture/chargingthefuture/releases';

export const SE_ME_LINKS = {
  credits: '/apps/service-credits',
  account: '/account',
  accountData: '/account/data',
  blocks: '/account/blocks',
  survey: '/survey/quora-account-deletions',
  architect: '/admin',
  guide: '/guide',
  rules: '/guidelines',
  terms: '/terms',
  wallpapers: `${RELEASES}?q=wallpapers`,
  androidApp: `${RELEASES}?q=mobile`,
} as const;

// The Tools grid: six tiles, each opening the part of the app that does it. Icons are 24-unit paths.
export type SeMeTool = { key: string; label: string; href: string; tint: string; icon: string };

export const SE_ME_TOOLS: readonly SeMeTool[] = [
  { key: 'lighthouse', label: 'A place to stay', href: '/apps/lighthouse', tint: '#ede2d9', icon: 'M4 11l8-6 8 6v9H4zM10 20v-5h4v5' },
  { key: 'mutual-time', label: 'Trade hours', href: '/apps/mutual-time', tint: '#e3ead9', icon: 'M12 7v5l3 2M12 3a9 9 0 1 0 .01 0' },
  { key: 'skill-up', label: 'Learn a skill', href: '/apps/skill-up', tint: '#dfe6ee', icon: 'M3 9l9-5 9 5-9 5zM7 11v5c3 2 7 2 10 0v-5' },
  { key: 'workforce', label: 'Our numbers', href: '/apps/workforce', tint: '#f3e3cf', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { key: 'knowledge', label: 'Bring your writing', href: '/knowledge', tint: '#f4dde1', icon: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3' },
  { key: 'click-log', label: 'Log what happened', href: '/apps/click-log', tint: '#ede2d9', icon: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5' },
];

// The tile's icon is drawn in the board's ink on its light tint, in every theme.
export const SE_ME_TOOL_INK = '#2a1a1d';

export const SE_ME_CREDIT_ICONS = {
  send: 'M5 12h14M13 6l6 6-6 6',
  receive: 'M19 12H5M11 6l-6 6 6 6',
  history: 'M4 6h16M4 12h16M4 18h10',
} as const;

export const SE_ME_GEAR_ICON = 'M4 7h10M18 7h2M4 17h2M10 17h10';

// The three profile prompts, each a short optional line the member writes in Me.
export type SeMePromptKey = 'canHelpWith' | 'needs' | 'askMeAbout';
export type SeMePrompts = Record<SeMePromptKey, string>;
export const SE_ME_PROMPT_KEYS: readonly SeMePromptKey[] = ['canHelpWith', 'needs', 'askMeAbout'];
export const SE_ME_PROMPT_LABELS: Record<SeMePromptKey, string> = {
  canHelpWith: 'I can help with',
  needs: 'I need',
  askMeAbout: 'Ask me about',
};
export const SE_ME_PROMPT_MAX = 140;
export const SE_ME_EMPTY_PROMPTS: SeMePrompts = { canHelpWith: '', needs: '', askMeAbout: '' };

// Reads the three prompts from a request or answer body. Each is trimmed, inner runs of spaces and
// line breaks are folded to one space, and a missing one is empty. Null when any is not text or is
// longer than SE_ME_PROMPT_MAX.
export function seParseMePrompts(body: unknown): SeMePrompts | null {
  const value = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const out: SeMePrompts = { ...SE_ME_EMPTY_PROMPTS };
  for (const key of SE_ME_PROMPT_KEYS) {
    const raw = value[key] ?? '';
    if (typeof raw !== 'string') return null;
    const text = raw.replace(/\s+/g, ' ').trim();
    if (text.length > SE_ME_PROMPT_MAX) return null;
    out[key] = text;
  }
  return out;
}

// What GET /api/account/me answers: since when the member has been here, their badges and prompts.
export type SeMeBadge = 'architect' | 'weaver';
// censusAdded: the member has answered the Quora census (Settings → Quora census).
export type SeMeProfile = { sinceIso: string | null; badges: SeMeBadge[]; prompts: SeMePrompts; censusAdded: boolean };
export const SE_ME_BADGE_LABELS: Record<SeMeBadge, string> = {
  architect: 'System Architect',
  weaver: 'Weavers of the Commons',
};

const SINCE = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function seMeSince(sinceIso: string | null): string | null {
  if (!sinceIso) return null;
  const at = Date.parse(sinceIso);
  return Number.isNaN(at) ? null : SINCE.format(new Date(at));
}

// The name at the top of Me: the member's handle without the @, as on the board.
export function seMeName(username: string | null | undefined): string {
  const name = (username ?? '').replace(/^@/, '').trim();
  return name || 'Survivor';
}

// The sub-screens Me opens in place. Saved is built separately and has its own place in the row.
export type SeMeView = 'me' | 'settings' | 'theme' | 'read' | 'hidden' | 'prompts';
export const SE_ME_VIEWS: readonly SeMeView[] = ['me', 'settings', 'theme', 'read', 'hidden', 'prompts'];
export function isSeMeView(value: unknown): value is SeMeView {
  return typeof value === 'string' && (SE_ME_VIEWS as readonly string[]).includes(value);
}

export const SE_ME_WORDS = {
  since: 'since',
  aven: 'Aven',
  settings: 'Settings',
  backToMe: 'Back to Me',
  credits: 'ServiceCredits',
  creditsNote: 'credits, not money',
  creditsFailed: 'Could not read your ServiceCredits this time.',
  send: 'Send',
  receive: 'Receive',
  receiveCopied: (handle: string) => `Copied ${handle}. Anyone can send to it.`,
  receiveCopyFailed: (handle: string, reason: string) => `Could not copy (${reason}). Your handle is ${handle}.`,
  receiveNoHandle: 'Choose a handle in Account and data to receive.',
  history: 'History',
  read: 'Read',
  hidden: 'Hidden',
  readIntro: 'Cards you marked done that are still around.',
  hiddenIntro: 'Cards you said were not for you. They do not come back to Today.',
  listEmpty: 'Nothing here yet.',
  listFailed: 'Could not read this list.',
  tools: 'Tools',
  profileFailed: 'Could not read your profile this time.',
  promptsEdit: 'Edit',
  promptsAdd: 'Add a line about you',
  promptsTitle: 'About you',
  promptsSave: 'Save',
  promptsSaving: 'Saving…',
  promptsCancel: 'Cancel',
  promptsFailed: 'Could not save.',
  architect: 'System Architect',
};

// The member's choice of colors. Saved on the account; the device keeps a copy so the first frame
// is drawn in the right colors before the account answers. Anything unreadable falls back to the
// default.
export type SeThemeChoice = { color: SeThemeColor; mode: SeThemeMode };
export const SE_THEME_STORE_KEY = 'se-theme';

export function seParseThemeChoice(raw: string | null | undefined): SeThemeChoice {
  try {
    const value = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return {
      color: isSeThemeColor(value.color) ? value.color : SE_DEFAULT_THEME.color,
      mode: isSeThemeMode(value.mode) ? value.mode : SE_DEFAULT_THEME.mode,
    };
  } catch {
    return { ...SE_DEFAULT_THEME };
  }
}

// One line in Me → Read or Hidden (GET /api/today/marks?mark=done|not_for_me).
export type SeMarkedCard = { id: string; kind: SeCardKind; label: string; title: string; href: string };
