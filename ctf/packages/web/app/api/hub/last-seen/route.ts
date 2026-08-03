import { NextResponse } from 'next/server';
import type { HubLastSeenResponse } from 'lib/hub/types';
import { getHubLastSeen, updateHubLastSeen } from 'lib/feed/repository';
import { reportError } from 'lib/observability/report';
import { requireHubAccess } from '../_lib';
import { ensureMutationCsrf } from '../../feed/_lib';
import { failureReason } from 'lib/errors/failure';

// Per-member "last seen" marker for the Hub home channel. The chat reads it on entry to
// place a single "New messages" divider, and writes it after the member has viewed the chat.
// Both are best-effort: a failure here must never break the chat, so the client treats any
// error as "no marker" / "not recorded".

export async function GET() {
  const gate = await requireHubAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const lastSeenAtIso = await getHubLastSeen(gate.auth.userId);
    const response: HubLastSeenResponse = { ok: true, lastSeenAtIso };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'hub', op: 'read_last_seen' });
    return NextResponse.json(
      { ok: false, message: 'Unable to read last-seen marker.' },
      { status: 503 },
    );
  }
}

type LastSeenRequestBody = {
  // Optional client timestamp of when the member last viewed the chat. Clamped to server NOW()
  // and never allowed to move the marker backwards. Absent → mark seen at NOW().
  seenAtIso?: unknown;
};

export async function POST(request: Request) {
  const gate = await requireHubAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: LastSeenRequestBody = {};
  try {
    // An empty body is allowed (mark seen at NOW()); only reject malformed JSON.
    const raw = await request.text();
    if (raw.trim().length > 0) {
      body = JSON.parse(raw) as LastSeenRequestBody;
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'Invalid JSON payload.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const seenAtIso = typeof body.seenAtIso === 'string' ? body.seenAtIso : null;

  try {
    const lastSeenAtIso = await updateHubLastSeen(gate.auth.userId, seenAtIso);
    const response: HubLastSeenResponse = { ok: true, lastSeenAtIso };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'hub', op: 'update_last_seen' });
    return NextResponse.json(
      { ok: false, message: 'Unable to update last-seen marker.' },
      { status: 503 },
    );
  }
}
