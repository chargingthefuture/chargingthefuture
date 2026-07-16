import { NextResponse } from 'next/server';
import { getBeaconHlsPlaybackUrl } from 'lib/beacon/stream';
import { getLatestReplayBeaconEvent, getLiveBeaconEvent } from 'lib/beacon/repository';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';

export const dynamic = 'force-dynamic';

// Public: the currently-live event (or null) plus the public HLS playback URL, and the last replay
// for the idle state. No sign-in required — this is what lets anyone watch with just a link.
export async function GET(request: Request) {
  // Per-IP brake against bulk scraping of the anonymous read (see lib/security/rate-limit.ts).
  const limited = enforcePublicReadRateLimit(request, 'beacon-current');
  if (limited) {
    return limited;
  }

  try {
    const liveEvent = await getLiveBeaconEvent();
    const replayEvent = await getLatestReplayBeaconEvent();
    let hlsPlaybackUrl: string | null = null;
    if (liveEvent) {
      try {
        hlsPlaybackUrl = await getBeaconHlsPlaybackUrl(liveEvent.id);
      } catch (error) {
        // A Stream lookup failure must not break the public viewer; show the event without the URL.
        reportError(error, { area: 'beacon', op: 'current_hls', extra: { eventId: liveEvent.id } });
      }
    }
    return NextResponse.json({ ok: true, event: liveEvent, hlsPlaybackUrl, replay: replayEvent }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'current' });
    return NextResponse.json({ ok: true, event: null, hlsPlaybackUrl: null, replay: null }, { status: 200 });
  }
}
