import { NextResponse } from 'next/server';
import type { HubDMsResponse } from 'lib/hub/types';
import { requireHubAccess } from '../_lib';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireHubAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    // TODO: Fetch hub_dm_threads for the current user.
    // Include peer-to-peer survivor conversations and system bot conversations.
    // For now, return empty list to satisfy type contract.

    const response: HubDMsResponse = {
      threads: [],
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'hub', op: 'dms' });
    return NextResponse.json(
      {
        ok: false,
        message: 'Unable to read Hub DMs.',
      },
      { status: 503 },
    );
  }
}
