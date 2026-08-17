import { NextResponse } from 'next/server';
import { ensureLighthouseMatchChannel, createLighthouseParticipantToken } from 'lib/lighthouse/stream';
import { requireLighthouseReadAccess } from 'lib/lighthouse/_lib';
import { listMatches } from 'lib/lighthouse/repository';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { reportError } from 'lib/observability/report';

export async function POST(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  if (!matchId) {
    return NextResponse.json({ ok: false, message: 'Missing matchId' }, { status: 400 });
  }

  const gate = await requireLighthouseReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const userId = gate.auth.userId;

  // Fetch matches for this user and find the one with matchId
  const matches = await listMatches(userId);
  const match = matches.find((m) => m.id === matchId);
  if (!match) {
    return NextResponse.json({ ok: false, message: 'Match not found or access denied' }, { status: 404 });
  }

  // Chat exists only for accepted matches. A pending/rejected/canceled/completed match must not
  // be able to provision a live Stream channel or token.
  if (match.status !== 'accepted') {
    return NextResponse.json(
      { ok: false, message: 'Chat is only available for accepted matches.' },
      { status: 403 },
    );
  }

  try {
    const streamChannelId = await ensureLighthouseMatchChannel({
      matchId: match.id,
      seekerUserId: match.seekerUserId,
      seekerDisplayName: buildIdentityDisplayName(null, match.seekerUserId),
      hostUserId: match.hostUserId,
      hostDisplayName: buildIdentityDisplayName(null, match.hostUserId),
    });
    if (!streamChannelId) {
      return NextResponse.json({ ok: false, message: 'Unable to create chat channel' }, { status: 500 });
    }
    const credentials = await createLighthouseParticipantToken(
      userId,
      buildIdentityDisplayName(gate.auth.username, userId),
    );
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Unable to create participant token' }, { status: 500 });
    }
    // Single canonical key: `streamChannelId` is the real Stream channel id. Web and mobile both
    // read this one key.
    return NextResponse.json({ ok: true, streamChannelId, ...credentials });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    reportError(e, { area: 'lighthouse', op: 'matches_matchid_chat' });
    return NextResponse.json({ ok: false, message: e.message || 'Error creating chat channel' }, { status: 500 });
  }
}
