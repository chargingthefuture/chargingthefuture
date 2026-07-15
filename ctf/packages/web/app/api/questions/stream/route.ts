import { NextResponse } from 'next/server';
import { getFeedStreamCredentials } from 'lib/feed/stream';
import { requireFeedReadAccess } from '../../feed/_lib';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { reportError } from 'lib/observability/report';

// Mints Stream chat credentials for the Feed "Questions" channel. Questions is one of the Feed's three
// channels, so it reuses the Feed read-access gate and the shared Stream identity — only the channel
// it connects to differs (ctf-feed-questions). The mobile Questions screen calls this route.
export async function POST() {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const credentials = await getFeedStreamCredentials(
      gate.auth.userId,
      buildIdentityDisplayName(gate.auth.username, gate.auth.userId),
      'questions',
    );
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Stream service is not configured.' }, { status: 503 });
    }
    // Return the exact field names the mobile client reads, rather than spreading `credentials`,
    // so the response shape is guaranteed at this boundary and cannot silently drift to `undefined`
    // if `getFeedStreamCredentials` ever changes its internal key names.
    return NextResponse.json(
      {
        ok: true,
        streamApiKey: credentials.streamApiKey,
        streamUserId: credentials.streamUserId,
        streamToken: credentials.streamToken,
        streamChannelId: credentials.streamChannelId,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'feed', op: 'questions_stream' });
    return NextResponse.json({ ok: false, message: 'Unable to fetch Stream credentials.' }, { status: 500 });
  }
}
