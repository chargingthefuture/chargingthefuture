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

  try {
    const channelId = await ensureLighthouseMatchChannel({
      matchId: match.id,
      seekerUserId: match.seekerUserId,
      seekerDisplayName: buildIdentityDisplayName(null, match.seekerUserId),
      hostUserId: match.hostUserId,
      hostDisplayName: buildIdentityDisplayName(null, match.hostUserId),
    });
    if (!channelId) {
      return NextResponse.json({ ok: false, message: 'Unable to create chat channel' }, { status: 500 });
    }
    const credentials = await createLighthouseParticipantToken(
      userId,
      buildIdentityDisplayName(gate.auth.username, userId),
    );
    if (!credentials) {
      return NextResponse.json({ ok: false, message: 'Unable to create participant token' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, channelId, ...credentials });
  } catch (e) {
    reportError(e, { area: 'lighthouse', op: 'match_chat_channel_create', extra: { userId, matchId } });
    const message = e instanceof Error ? e.message : '';
    return NextResponse.json({ ok: false, message: message || 'Error creating chat channel' }, { status: 500 });
  }
}
