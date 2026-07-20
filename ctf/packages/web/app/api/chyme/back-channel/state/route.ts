import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { getBackChannelState } from 'lib/chyme/back-channel';
import { reportError } from 'lib/observability/report';
import { requireChymeAccess } from '../../_lib';

// GET /api/chyme/back-channel/state
// Poll-driven state for the current member: an incoming invite to answer, a pending outgoing invite
// (the "Invite sent…" badge), and/or the live call to show the panel for. Reaps stale rows first so
// nothing returned is out of date. Read-only; no CSRF. Not audited (high-frequency poll).
export async function GET() {
  const gate = await requireChymeAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const state = await getBackChannelState(gate.identity.userId);
    return NextResponse.json(state, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'back_channel_state', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.persistenceUnavailable, message: 'Unable to load Back Channel state.' },
      { status: 503 },
    );
  }
}
