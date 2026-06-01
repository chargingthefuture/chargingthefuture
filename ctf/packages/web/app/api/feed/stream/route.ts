import { NextResponse } from 'next/server';
import { getFeedStreamCredentials } from 'lib/feed/stream';
import { requireFeedReadAccess } from '../_lib';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { reportError } from 'lib/observability/report';

export async function POST() {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const credentials = await getFeedStreamCredentials(
      gate.auth.userId,
      buildIdentityDisplayName(gate.auth.username, gate.auth.userId),
    );
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Stream service is not configured.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true, ...credentials }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'stream_credentials', extra: { userId: gate.auth.userId } });
    return NextResponse.json({ ok: false, message: 'Unable to fetch Stream credentials.' }, { status: 500 });
  }
}
