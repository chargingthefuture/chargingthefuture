import { NextResponse } from 'next/server';
import { buildIdentityDisplayName } from 'lib/auth/request-identity';
import { ensureBeaconMutationCsrf, requireBeaconMemberAccess } from 'lib/beacon/_lib';
import { BEACON_ERROR_CODE } from 'lib/beacon/constants';
import { getBeaconEvent } from 'lib/beacon/repository';
import { createBeaconMemberChatCredentials } from 'lib/beacon/stream';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// Mint a Stream Chat token for the live event chat. Requires a signed-in member — this is the
// sign-in-to-chat gate. Anonymous callers get 401 from the member gate and can only watch.
export async function POST(request: Request, context: RouteContext) {
  const csrfDeny = ensureBeaconMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireBeaconMemberAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await context.params;

  try {
    const event = await getBeaconEvent(id);
    if (!event) {
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.notFound, message: 'Event not found.' },
        { status: 404 },
      );
    }

    const displayName = buildIdentityDisplayName(gate.auth.username, gate.auth.userId);
    const credentials = await createBeaconMemberChatCredentials({
      userId: gate.auth.userId,
      name: displayName,
      eventId: event.id,
    });

    if (!credentials) {
      return NextResponse.json(
        { ok: false, code: BEACON_ERROR_CODE.streamUnavailable, message: 'Live chat is not configured.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, displayName, ...credentials }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'chat_token', extra: { eventId: id } });
    return NextResponse.json(
      { ok: false, code: BEACON_ERROR_CODE.streamUnavailable, message: 'Live chat unavailable.' },
      { status: 503 },
    );
  }
}
