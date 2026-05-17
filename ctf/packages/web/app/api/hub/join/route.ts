import { NextResponse } from 'next/server';
import type { HubJoinResponse } from 'lib/hub/types';
import { requireHubAccess } from '../_lib';

export async function POST() {
  const gate = await requireHubAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    // TODO: Create/fetch GetStream credentials for Hub scope.
    // Hub manages its own GetStream channels and tokens, separate from any other plugin.
    // For now, return stub credentials to satisfy type contract.

    const response: HubJoinResponse = {
      ok: true,
      streamApiKey: 'todo-stream-api-key',
      streamChannelId: 'hub-general',
      streamUserId: `hub-${gate.identity.userId}`,
      streamToken: 'todo-stream-token',
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: 'Unable to join Hub.',
      },
      { status: 503 },
    );
  }
}
