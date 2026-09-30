import type { BeaconEvent } from './repository';

// The public shape of a recorded broadcast, shared by the replay list and the podcast feed. It
// carries what a listener needs and nothing about who ran the broadcast: no host user id, no Stream
// call id, no Commons post ids.

export const BEACON_APP_ORIGIN = 'https://app.chargingthefuture.com';
export const BEACON_WATCH_URL = `${BEACON_APP_ORIGIN}/apps/beacon`;
// The blog page that lists every recorded broadcast. The podcast feed's channel link points here.
export const BLOG_STREAMS_PAGE_URL = 'https://chargingthefuture.github.io/chargingthefuture/streams';
export const BEACON_REPLAY_FEED_URL = `${BEACON_APP_ORIGIN}/api/beacon/replays/feed`;

export const BEACON_REPLAY_PAGE_SIZE = 20;
export const BEACON_REPLAY_FEED_ITEMS = 100;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBeaconEventId(value: string): boolean {
  return UUID_REGEX.test(value);
}

// Where the archive workflow puts this project's copy of each recording: one GitHub release in this
// repository, one asset per broadcast named by event id. The recording route only trusts an address
// under this prefix, so the write-back cannot be used to point listeners anywhere else.
export const BEACON_ARCHIVE_URL_PREFIX =
  'https://github.com/chargingthefuture/chargingthefuture/releases/download/beacon-recordings/';

export function isBeaconArchiveUrl(value: string, eventId: string): boolean {
  return value === `${BEACON_ARCHIVE_URL_PREFIX}${eventId}.mp4`;
}

export type PublicBeaconReplay = {
  id: string;
  title: string;
  description: string;
  startedAtIso: string | null;
  endedAtIso: string | null;
  // The app's own address for the recording. It redirects to a current file address on every
  // request, so it keeps working after the address Stream first delivered has expired.
  mediaUrl: string;
  watchUrl: string;
};

export function beaconReplayMediaUrl(eventId: string): string {
  return `${BEACON_APP_ORIGIN}/api/beacon/replays/${eventId}/recording`;
}

export function toPublicBeaconReplay(event: BeaconEvent): PublicBeaconReplay {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startedAtIso: event.startedAtIso,
    endedAtIso: event.endedAtIso,
    mediaUrl: beaconReplayMediaUrl(event.id),
    watchUrl: BEACON_WATCH_URL,
  };
}

// Headers for the anonymous reads. Open to any origin because the blog is a static site on another
// host, and no cookie ever changes what these routes answer.
export const BEACON_PUBLIC_READ_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // A replay is added a few times a month, so a short shared cache costs nothing.
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=900',
} as const;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function durationSeconds(replay: PublicBeaconReplay): number | null {
  if (!replay.startedAtIso || !replay.endedAtIso) {
    return null;
  }
  const seconds = Math.round((Date.parse(replay.endedAtIso) - Date.parse(replay.startedAtIso)) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

// The podcast feed: RSS 2.0 with the iTunes podcast tags, one item per recorded broadcast, newest
// first. The enclosure is the app's redirecting recording address, typed as MP4 video because that is
// what Stream records. The file size is not known without downloading it, so `length` is 0, which
// feed readers and podcast apps accept.
export function buildBeaconReplayFeedXml(replays: PublicBeaconReplay[], builtAt: Date): string {
  const items = replays
    .map((replay) => {
      const published = replay.endedAtIso ?? replay.startedAtIso;
      const duration = durationSeconds(replay);
      const summary = replay.description.trim().length > 0 ? replay.description : replay.title;
      return [
        '    <item>',
        `      <title>${escapeXml(replay.title)}</title>`,
        `      <link>${escapeXml(BLOG_STREAMS_PAGE_URL)}#${replay.id}</link>`,
        `      <guid isPermaLink="false">beacon-replay-${replay.id}</guid>`,
        published ? `      <pubDate>${new Date(published).toUTCString()}</pubDate>` : '',
        `      <description>${escapeXml(summary)}</description>`,
        `      <enclosure url="${escapeXml(replay.mediaUrl)}" length="0" type="video/mp4" />`,
        duration ? `      <itunes:duration>${duration}</itunes:duration>` : '',
        '    </item>',
      ]
        .filter((line) => line.length > 0)
        .join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Charging The Future: recorded broadcasts</title>',
    `    <link>${escapeXml(BLOG_STREAMS_PAGE_URL)}</link>`,
    `    <atom:link href="${escapeXml(BEACON_REPLAY_FEED_URL)}" rel="self" type="application/rss+xml" />`,
    '    <description>Every live broadcast from the Charging The Future app, recorded and listed newest first. Each one can also be watched in the app with no sign-in.</description>',
    '    <language>en-us</language>',
    `    <lastBuildDate>${builtAt.toUTCString()}</lastBuildDate>`,
    '    <itunes:author>Charging The Future</itunes:author>',
    '    <itunes:explicit>false</itunes:explicit>',
    items,
    '  </channel>',
    '</rss>',
    '',
  ]
    .filter((line, index, all) => line.length > 0 || index === all.length - 1)
    .join('\n');
}
