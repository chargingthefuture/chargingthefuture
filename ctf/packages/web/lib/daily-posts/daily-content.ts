// The blurbs and live-stream topics for /admin/daily-posts, read from the file the blog's build
// publishes (wiki-site scripts/src/build-daily-content.ts, from content/daily-content.yaml). The
// copy is written and checked there; this file only reads it and picks the day's share.

import { daysSinceEpoch } from './rotation';

export const DAILY_CONTENT_URL = 'https://chargingthefuture.github.io/chargingthefuture/daily-content.json';

export type DailyContentLine = { id: string; label: string };
export type DailyBlurb = { id: string; line: string; link: string; text: string };
export type DailyLiveTopic = { id: string; line: string; link: string; title: string; points: string[] };
export type DailyContent = { lines: DailyContentLine[]; blurbs: DailyBlurb[]; live: DailyLiveTopic[] };

export type DailyContentRead = { ok: true; content: DailyContent } | { ok: false; reason: string };

const isStr = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

function isLine(value: unknown): value is DailyContentLine {
  const v = value as Record<string, unknown> | null;
  return !!v && isStr(v.id) && isStr(v.label);
}

function isBlurb(value: unknown): value is DailyBlurb {
  const v = value as Record<string, unknown> | null;
  return !!v && isStr(v.id) && isStr(v.line) && isStr(v.link) && isStr(v.text);
}

function isLive(value: unknown): value is DailyLiveTopic {
  const v = value as Record<string, unknown> | null;
  return !!v && isStr(v.id) && isStr(v.line) && isStr(v.link) && isStr(v.title) && Array.isArray(v.points) && v.points.every(isStr);
}

/** Never throws: an unreadable file leaves the rest of the screen working, with the reason. */
export async function readDailyContent(): Promise<DailyContentRead> {
  let response: Response;
  try {
    response = await fetch(DAILY_CONTENT_URL, { next: { revalidate: 600 } });
  } catch (error) {
    return { ok: false, reason: `The blog could not be reached at ${DAILY_CONTENT_URL}: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!response.ok) {
    return { ok: false, reason: `The blog answered ${response.status} for ${DAILY_CONTENT_URL}. The file is published by the blog's next build.` };
  }
  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch (error) {
    return { ok: false, reason: `The blog's daily content is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!Array.isArray(body?.lines) || !Array.isArray(body.blurbs) || !Array.isArray(body.live)) {
    return { ok: false, reason: 'The blog\'s daily content has no "lines", "blurbs" or "live" list.' };
  }
  return { ok: true, content: { lines: body.lines.filter(isLine), blurbs: body.blurbs.filter(isBlurb), live: body.live.filter(isLive) } };
}

export type DailyPick = {
  /** One blurb from each line, in line order. */
  blurbs: Array<DailyBlurb & { lineLabel: string }>;
  /** The live topic: one line a day in turn, and within a line its topics in order. */
  live: (DailyLiveTopic & { lineLabel: string }) | null;
};

/** The day's share. Adding an entry to the end of a line changes nothing on an earlier day. */
export function dailyPick(content: DailyContent, date: string): DailyPick {
  const day = Math.max(0, daysSinceEpoch(date));
  const lines = content.lines;
  const blurbs = lines.flatMap((line) => {
    const own = content.blurbs.filter((blurb) => blurb.line === line.id);
    return own.length > 0 ? [{ ...own[day % own.length], lineLabel: line.label }] : [];
  });
  const withLive = lines.filter((line) => content.live.some((topic) => topic.line === line.id));
  if (withLive.length === 0) return { blurbs, live: null };
  const line = withLive[day % withLive.length];
  const topics = content.live.filter((topic) => topic.line === line.id);
  const round = Math.floor(day / withLive.length);
  return { blurbs, live: { ...topics[round % topics.length], lineLabel: line.label } };
}

/** What a blurb's copy control hands over: the blurb, then its link on its own line. */
export function blurbPasteText(blurb: Pick<DailyBlurb, 'text' | 'link'>): string {
  return `${blurb.text}\n\n${blurb.link}`;
}

/** What a live topic's copy control hands over: notes for the stream and the stream's caption. */
export function livePasteText(topic: Pick<DailyLiveTopic, 'title' | 'points' | 'link'>): string {
  return `${topic.title}\n\n${topic.points.map((point) => `- ${point}`).join('\n')}\n\n${topic.link}`;
}
