import { NextResponse } from 'next/server';
import { getFeedStreamCredentials } from 'lib/feed/stream';
import { requireFeedAccess } from '../../_lib';

export async function POST() {
  const gate = await requireFeedAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const credentials = await getFeedStreamCredentials(gate.auth.userId, gate.identity.displayName);
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Stream service is not configured.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true, ...credentials }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: 'Unable to fetch Stream credentials.' }, { status: 500 });
  }
}
