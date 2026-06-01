import { NextResponse } from 'next/server';
import { requireFeedReadAccess } from '../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { getFeedConfig } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireFeedReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const config = await getFeedConfig();
    return NextResponse.json({ config }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'config' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to load feed config.' },
      { status: 503 },
    );
  }
}
