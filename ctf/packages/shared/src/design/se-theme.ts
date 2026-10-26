// Skills Economy 3.1.0 design values, read by web and Android alike. The four colors match the
// wallpapers (ctf/scripts/wallpapers/); forest and gold, dark, is the default.
// Plan: ctf/docs/developer/SOCIAL_REDESIGN_3_1_PLAN.md ("Look").

export type SeThemeColor = 'forest' | 'burgundy' | 'coral' | 'teal-purple';
export type SeThemeMode = 'dark' | 'light';

export const SE_THEME_COLORS: readonly SeThemeColor[] = ['forest', 'burgundy', 'coral', 'teal-purple'] as const;
export const SE_THEME_MODES: readonly SeThemeMode[] = ['dark', 'light'] as const;
export const SE_DEFAULT_THEME: { color: SeThemeColor; mode: SeThemeMode } = { color: 'forest', mode: 'dark' };

export const SE_THEME_LABELS: Record<SeThemeColor, string> = {
  forest: 'Forest and gold',
  burgundy: 'Burgundy',
  coral: 'Coral',
  'teal-purple': 'Teal and purple',
};

// The kinds of card in Today. Each has one accent; the card shape is the same for all.
export type SeCardKind = 'ask' | 'offer' | 'story' | 'match' | 'mood' | 'numbers' | 'replay';

export type SeKindColors = Record<SeCardKind, string>;

export type SeThemeTokens = {
  bg: string;
  card: string;
  sunk: string;
  ink: string;
  soft: string;
  hair: string;
  line: string;
  hero: string;
  onHero: string;
  pick: string;
  btn: string;
  onBtn: string;
  live: string;
  liveBadge: string;
  onLiveBadge: string;
  kind: SeKindColors;
  onKind: string;
};

const LIGHT_KINDS: SeKindColors = {
  ask: '#a4472f',
  offer: '#4f6b4a',
  story: '#7d5c22',
  match: '#3c5a74',
  mood: '#6a4c8c',
  numbers: '#2d6b70',
  replay: '#2a1a1d',
};

const DARK_KINDS: SeKindColors = {
  ask: '#f2a07f',
  offer: '#9dbb94',
  story: '#d9b06a',
  match: '#8fb0cc',
  mood: '#c3a6e0',
  numbers: '#7fc1c4',
  replay: '#e8dcd4',
};

const SAND_LIGHT = {
  bg: '#f6efe8',
  card: '#fffaf6',
  sunk: '#ede2d9',
  ink: '#2a1a1d',
  soft: '#6e5b5e',
  hair: '#e6d6cd',
  line: '#2a1a1d',
  live: '#2f7d4a',
  liveBadge: '#a8475b',
  onLiveBadge: '#fffaf6',
  kind: LIGHT_KINDS,
  onKind: '#fffaf6',
};

export const SE_THEMES: Record<SeThemeColor, Record<SeThemeMode, SeThemeTokens>> = {
  forest: {
    light: { ...SAND_LIGHT, hero: '#1f4a37', onHero: '#f7ece4', pick: '#e3b74f', btn: '#1f4a37', onBtn: '#f6efe8' },
    dark: {
      bg: '#0f1a15', card: '#17251f', sunk: '#20332a', ink: '#f1e4dc', soft: '#bba8a9', hair: '#2c4438', line: '#3c5a4b',
      hero: '#173528', onHero: '#f7ece4', pick: '#e3b74f', btn: '#e3b74f', onBtn: '#10201a',
      live: '#6fcf8e', liveBadge: '#e5909f', onLiveBadge: '#10201a', kind: DARK_KINDS, onKind: '#10201a',
    },
  },
  burgundy: {
    light: { ...SAND_LIGHT, hero: '#6b1f2e', onHero: '#f7ece4', pick: '#f2c46d', btn: '#6b1f2e', onBtn: '#f7ece4' },
    dark: {
      bg: '#170e10', card: '#24151a', sunk: '#33202a', ink: '#f1e4dc', soft: '#bba8a9', hair: '#452a30', line: '#5e3a43',
      hero: '#4a1420', onHero: '#f7ece4', pick: '#f2c46d', btn: '#f7ece4', onBtn: '#170e10',
      live: '#6fcf8e', liveBadge: '#e5909f', onLiveBadge: '#170e10', kind: DARK_KINDS, onKind: '#170e10',
    },
  },
  coral: {
    light: { ...SAND_LIGHT, hero: '#2a1a1d', onHero: '#f7ece4', pick: '#f0a39a', btn: '#2a1a1d', onBtn: '#fffaf6' },
    dark: {
      bg: '#121010', card: '#1d1918', sunk: '#2a2422', ink: '#f1e4dc', soft: '#b8aaa6', hair: '#3a3230', line: '#4d4441',
      hero: '#2a1a1d', onHero: '#f7ece4', pick: '#f0a39a', btn: '#f0a39a', onBtn: '#121010',
      live: '#6fcf8e', liveBadge: '#e5909f', onLiveBadge: '#121010', kind: DARK_KINDS, onKind: '#121010',
    },
  },
  'teal-purple': {
    light: { ...SAND_LIGHT, hero: '#1f5f5b', onHero: '#f7ece4', pick: '#c9b6f0', btn: '#1f5f5b', onBtn: '#f6efe8' },
    dark: {
      bg: '#0f0e17', card: '#1a1826', sunk: '#24223a', ink: '#efe9f6', soft: '#b2aac4', hair: '#33304a', line: '#46425f',
      hero: '#1d3b4a', onHero: '#efe9f6', pick: '#3fb8af', btn: '#3fb8af', onBtn: '#0f0e17',
      live: '#6fcf8e', liveBadge: '#e5909f', onLiveBadge: '#0f0e17', kind: DARK_KINDS, onKind: '#0f0e17',
    },
  },
};

export function seTheme(color: SeThemeColor = SE_DEFAULT_THEME.color, mode: SeThemeMode = SE_DEFAULT_THEME.mode): SeThemeTokens {
  return SE_THEMES[color][mode];
}

export function isSeThemeColor(value: unknown): value is SeThemeColor {
  return typeof value === 'string' && (SE_THEME_COLORS as readonly string[]).includes(value);
}

export function isSeThemeMode(value: unknown): value is SeThemeMode {
  return value === 'dark' || value === 'light';
}

// Type and shape. Flat, hard shadows; no blur, no glass, no gradients.
export const SE_FONTS = {
  serif: 'Newsreader',
  sans: 'DM Sans',
} as const;

export const SE_RADIUS = {
  card: 18,
  hero: 22,
  sheet: 26,
  pill: 999,
} as const;

// A hard shadow is a solid offset in the theme's `line` color, never blurred.
export const SE_HARD_SHADOW_PX = {
  button: 2,
  card: 3,
  hero: 4,
} as const;

export const SE_MIN_TOUCH_PX = 44;
