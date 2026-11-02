// The ten themes the Daily Posts screen groups blog posts by, so a day can be given to one subject
// (owner request, 2026-11-02). A theme names what members get, not the part of the app that does
// it. Nothing in the app or on the blog uses these groups; they exist only for choosing what to
// post.
//
// A post is placed in every theme whose part of the app it links. The blog ends each post that
// speaks about the app with a "Where to find it in the app" list (wiki-site CLAUDE.md, "Link the
// Plugins a Post Names"), so the links in a post's text say which parts it covers. The owner can
// replace that placement for any post on the screen; a post that links none of these parts waits
// under Unsorted until they do.

export type DailyPostThemeId =
  | 'ti-radio'
  | 'places-to-stay'
  | 'reliable-rides'
  | 'finding-tis'
  | 'tis-to-help'
  | 'working-together'
  | 'state-of-the-tis'
  | 'taking-back-the-day'
  | 'real-information'
  | 'unsubscribing';

export type DailyPostTheme = {
  id: DailyPostThemeId;
  label: string;
  /** The parts of the app, by the address name a post links them with, that put a post here. */
  parts: string[];
};

export const DAILY_POST_THEMES: DailyPostTheme[] = [
  { id: 'ti-radio', label: 'TI Radio', parts: ['chyme', 'ti-radio'] },
  { id: 'places-to-stay', label: 'TIs with places to stay', parts: ['lighthouse'] },
  { id: 'reliable-rides', label: 'TIs with reliable rides', parts: ['trust-transport'] },
  { id: 'finding-tis', label: 'Finding other TIs', parts: ['directory', 'skills-hunt'] },
  { id: 'tis-to-help', label: 'TIs available to help', parts: ['foundation'] },
  {
    id: 'working-together',
    label: 'TIs working together',
    parts: ['peer-programming', 'socket-relay', 'socketrelay', 'what-works', 'skill-up'],
  },
  {
    id: 'state-of-the-tis',
    label: 'State of the TIs',
    parts: [
      'gdp',
      'gross-domestic-product',
      'workforce',
      'workforce-recruiter',
      'service-credits',
      'mood',
      'trust',
      'skills-taxonomy',
    ],
  },
  { id: 'taking-back-the-day', label: 'TIs taking back their day', parts: ['click-log'] },
  { id: 'real-information', label: 'TIs getting real and instant information', parts: ['knowledge'] },
  { id: 'unsubscribing', label: 'TIs unsubscribing from the psyop', parts: ['reader'] },
];

const THEME_IDS = new Set<string>(DAILY_POST_THEMES.map((theme) => theme.id));

export function isDailyPostThemeId(value: unknown): value is DailyPostThemeId {
  return typeof value === 'string' && THEME_IDS.has(value);
}

// An app address in a post's plain text: a plugin page, the Knowledge Library, or a guide section.
// Older posts still carry the app's earlier domain.
const APP_LINK = /app\.(?:lagatos|chargingthefuture)\.com\/(?:apps\/([a-z-]+)|(knowledge)|guide#([a-z-]+))/g;

/** The themes a post's own links place it in, in the order the themes are listed. */
export function themesFromText(text: string): DailyPostThemeId[] {
  const parts = new Set<string>();
  for (const match of text.matchAll(APP_LINK)) {
    parts.add(match[1] ?? match[2] ?? match[3]);
  }
  return DAILY_POST_THEMES.filter((theme) => theme.parts.some((part) => parts.has(part))).map((theme) => theme.id);
}
