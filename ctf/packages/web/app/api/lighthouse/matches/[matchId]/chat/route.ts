import { NextResponse } from 'next/server';
import { createLighthouseMatchChannel } from 'lib/lighthouse/stream';
import { getSessionFromRequest } from 'lib/auth/session';
import { authorizeUserForLighthouseMatch } from 'lib/lighthouse/auth';

async function createMatchChatChannelHandler(request: Request, matchId: string) {
  const session = await getSessionFromRequest(request);
  if (!session || !session.user) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }
  const authorized = await authorizeUserForLighthouseMatch(matchId, session.user.id);
  if (!authorized) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }
  try {
    const credentials = await createLighthouseMatchChannel(matchId);
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Unable to create chat channel' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...credentials });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message || 'Error creating chat channel' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { matchId: string } }) {
  const { matchId } = params;
  if (!matchId) {
    return NextResponse.json({ ok: false, message: 'Missing matchId' }, { status: 400 });
  }
  return createMatchChatChannelHandler(request, matchId);
}
