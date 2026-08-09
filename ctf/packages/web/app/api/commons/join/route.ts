import { NextResponse } from 'next/server';
import type { CommonsJoinResponse } from 'lib/commons/types';
import { getFeedStreamCredentials } from 'lib/feed/stream';
import { requireCommonsAccess } from '../_lib';
import { reportError } from 'lib/observability/report';

export async function POST() {
  const gate = await requireCommonsAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    // The Commons home chat shares the Feed's community channel (ctf-feed-community). We mint real
    // Stream credentials so the client can open a live connection beneath the existing custom UI and
    // receive real-time events (new posts, typing). The Commons keeps its own design; this only adds
    // the live layer on top.
    const credentials = await getFeedStreamCredentials(
      gate.identity.userId,
      gate.identity.displayName,
      'community',
    );

    // Stream not configured in this environment (no API key/secret). Tell the client clearly so it
    // skips the live connection and stays on polling. Commons must never break when Stream is absent.
    if (!credentials) {
      const notConfigured: CommonsJoinResponse = { ok: true, configured: false };
      return NextResponse.json(notConfigured, { status: 200 });
    }

    const response: CommonsJoinResponse = {
      ok: true,
      configured: true,
      streamApiKey: credentials.streamApiKey,
      streamChannelId: credentials.streamChannelId,
      streamUserId: credentials.streamUserId,
      streamToken: credentials.streamToken,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'hub', op: 'join' });
    return NextResponse.json(
      {
        ok: false,
        message: 'Unable to join Hub.',
      },
      { status: 503 },
    );
  }
}
