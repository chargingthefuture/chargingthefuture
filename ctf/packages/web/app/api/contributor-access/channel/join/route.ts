import { NextResponse } from 'next/server';
import { requireGatedChannelAccess } from '../_lib';
import { ensureMutationCsrf } from '../../admin/_lib';
import { getGatedStreamCredentials } from 'lib/contributor-access/gated-channel';
import { reportError } from 'lib/observability/report';

// Mint Stream live-layer credentials for the gated channel — same posture as /api/hub/join:
// the client opens a live connection beneath the custom UI for real-time refresh and typing, and
// when Stream is not configured the response says so and the client stays on polling. The gate
// has already verified the eligibility flag (or the moderator role) — membership is only ever
// derived from that flag.

export async function POST(request: Request) {
  const gate = await requireGatedChannelAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  // Same CSRF posture as every other mutation in this plugin: joining has a Stream-side effect
  // (the member is reconciled into the channel), so a cross-origin POST must not be able to
  // trigger it from a logged-in member's browser.
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    const credentials = await getGatedStreamCredentials(gate.auth.userId, gate.displayName);
    if (!credentials) {
      return NextResponse.json({ ok: true, configured: false }, { status: 200 });
    }
    return NextResponse.json(
      {
        ok: true,
        configured: true,
        streamApiKey: credentials.streamApiKey,
        streamChannelType: credentials.streamChannelType,
        streamChannelId: credentials.streamChannelId,
        streamUserId: credentials.streamUserId,
        streamToken: credentials.streamToken,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'contributor-access', op: 'channel_join' });
    return NextResponse.json({ ok: false, message: 'Unable to join the channel.' }, { status: 503 });
  }
}
