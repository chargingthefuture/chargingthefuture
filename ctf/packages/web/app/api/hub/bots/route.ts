import { NextResponse } from 'next/server';
import type { HubBotsResponse } from 'lib/hub/types';
import { requireHubAccess } from '../_lib';

export async function GET() {
  const gate = await requireHubAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    // TODO: Fetch hub_bots from database, filtered by is_active.
    // Include @comic bot and other system bots.
    // For now, return empty list to satisfy type contract.

    const response: HubBotsResponse = {
      bots: [],
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: 'Unable to read Hub bots.',
      },
      { status: 503 },
    );
  }
}
