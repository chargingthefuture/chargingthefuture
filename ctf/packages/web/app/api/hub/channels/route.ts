import { NextResponse } from 'next/server';
import type { HubChannelsResponse } from 'lib/hub/types';
import { requireHubAccess } from '../_lib';

export async function GET() {
  const gate = await requireHubAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    // TODO: Fetch hub_channels from database, filtered by visibility_scope.
    // For now, return stub channels to satisfy type contract.
    // At minimum, unauthenticated users see only #general; authenticated users see more.

    const response: HubChannelsResponse = {
      channels: [
        {
          slug: 'general',
          displayName: '#general',
          visibilityScope: 'public',
          streamChannelId: 'hub-general',
        },
      ],
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: 'Unable to read Hub channels.',
      },
      { status: 503 },
    );
  }
}
