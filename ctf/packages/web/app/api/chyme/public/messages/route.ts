import { NextResponse } from 'next/server';
import { CHYME_DEFAULT_MESSAGES_LIMIT, CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { getPublicRoomLiveState, listPublicRoomMessages } from 'lib/chyme/repository';
import { reportError } from 'lib/observability/report';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';

// Public, unauthenticated read of the one default room's recent chat, so a signed-out visitor who
// is listening can follow the conversation (owner directive, 2026-09-18: read without an account,
// sign in to write). Read-only by construction: this file has no POST. Messages come back only while
// the room is live, matching the audio — when nobody is in the call there is nothing to follow, and
// the page shows no chat. Rate-limited per IP like the sibling room route; the page polls every
// ten seconds, well under the limit.

const DEFAULT_PUBLIC_LIMIT = 50;

function parseLimit(url: string): number {
  const raw = new URL(url).searchParams.get('limit');
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_PUBLIC_LIMIT;
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PUBLIC_LIMIT;
  }
  return Math.min(Math.max(parsed, 1), CHYME_DEFAULT_MESSAGES_LIMIT);
}

export async function GET(request: Request) {
  const limited = enforcePublicReadRateLimit(request, 'chyme-public-messages');
  if (limited) {
    return limited;
  }

  try {
    const state = await getPublicRoomLiveState();
    if (!state.callActive) {
      return NextResponse.json({ ok: true, isLive: false, messages: [] });
    }
    const messages = await listPublicRoomMessages(parseLimit(request.url));
    return NextResponse.json({ ok: true, isLive: true, messages });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'public_messages' });
    const reason = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: `Unable to load the room chat: ${reason}` },
      { status: 503 },
    );
  }
}
