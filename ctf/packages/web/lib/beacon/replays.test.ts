import { describe, expect, it } from 'vitest';
import type { BeaconEvent } from './repository';
import { buildBeaconReplayFeedXml, isBeaconArchiveUrl, isBeaconEventId, toPublicBeaconReplay } from './replays';

const event: BeaconEvent = {
  id: '6f1c2d3e-4a5b-4c6d-8e7f-901234567890',
  title: 'Peace Battle <round 2> & questions',
  description: '',
  status: 'ended',
  hostUserId: 'user_host',
  streamCallType: 'livestream',
  streamCallId: 'beacon-6f1c2d3e-4a5b-4c6d-8e7f-901234567890',
  startedAtIso: '2026-09-20T18:00:00.000Z',
  endedAtIso: '2026-09-20T19:30:00.000Z',
  recordingUrl: 'https://stream.example/recording.mp4?signature=abc',
  recordingReadyAtIso: '2026-09-20T19:35:00.000Z',
  commonsLivePostId: null,
  commonsRecordingPostId: null,
  archivedRecordingUrl: null,
  recordingArchivedAtIso: null,
  createdAtIso: '2026-09-20T17:00:00.000Z',
  updatedAtIso: '2026-09-20T19:35:00.000Z',
};

describe('toPublicBeaconReplay', () => {
  it('points at the app recording route and leaves out the host and the stored file address', () => {
    const replay = toPublicBeaconReplay(event);
    expect(replay.mediaUrl).toBe(
      'https://app.chargingthefuture.com/api/beacon/replays/6f1c2d3e-4a5b-4c6d-8e7f-901234567890/recording',
    );
    expect(JSON.stringify(replay)).not.toContain('user_host');
    expect(JSON.stringify(replay)).not.toContain('signature=abc');
  });
});

describe('buildBeaconReplayFeedXml', () => {
  it('escapes titles, carries an enclosure and a duration, and falls back to the title as description', () => {
    const xml = buildBeaconReplayFeedXml([toPublicBeaconReplay(event)], new Date('2026-09-29T00:00:00Z'));
    expect(xml).toContain('<title>Peace Battle &lt;round 2&gt; &amp; questions</title>');
    expect(xml).toContain('<description>Peace Battle &lt;round 2&gt; &amp; questions</description>');
    expect(xml).toContain('type="video/mp4"');
    expect(xml).toContain('<itunes:duration>5400</itunes:duration>');
    expect(xml).toContain('<pubDate>Sun, 20 Sep 2026 19:30:00 GMT</pubDate>');
    expect(xml.endsWith('</rss>\n')).toBe(true);
  });

  it('builds a valid empty channel when nothing has been recorded', () => {
    const xml = buildBeaconReplayFeedXml([], new Date('2026-09-29T00:00:00Z'));
    expect(xml).not.toContain('<item>');
    expect(xml).toContain('</channel>');
  });
});

describe('isBeaconArchiveUrl', () => {
  it('accepts only this repository release asset named for the same event', () => {
    const good = `https://github.com/chargingthefuture/chargingthefuture/releases/download/beacon-recording-${event.id}/${event.id}.mp4`;
    expect(isBeaconArchiveUrl(good, event.id)).toBe(true);
    expect(isBeaconArchiveUrl(good, '00000000-0000-4000-8000-000000000000')).toBe(false);
    expect(isBeaconArchiveUrl('https://example.com/x.mp4', event.id)).toBe(false);
    // The old shared release, which immutable releases made impossible to add to.
    const shared = `https://github.com/chargingthefuture/chargingthefuture/releases/download/beacon-recordings/${event.id}.mp4`;
    expect(isBeaconArchiveUrl(shared, event.id)).toBe(false);
  });
});

describe('isBeaconEventId', () => {
  it('accepts a UUID and refuses anything else', () => {
    expect(isBeaconEventId(event.id)).toBe(true);
    expect(isBeaconEventId('feed')).toBe(false);
  });
});
