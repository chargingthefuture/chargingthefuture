import { NextResponse } from 'next/server';
import type { HubChannelsResponse } from 'lib/hub/types';
import { requireHubAccess } from '../_lib';
import { getContributorAccessConfig, isMemberEligible } from 'lib/contributor-access/repository';
import {
  GATED_CHANNEL_DISPLAY_NAME,
  GATED_CHANNEL_SLUG,
  GATED_STREAM_CHANNEL_ID,
} from 'lib/contributor-access/gated-channel-shared';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requireHubAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
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

    // The gated contributor channel is listed ONLY when it is open AND this member holds the
    // eligibility flag, OR is an admin. There is no separate "moderator" role for this channel: the
    // disclosed moderator is an admin acting as moderator (see lib/contributor-access/channel-repository.ts),
    // so `gate.auth.isAdmin` is the moderator/oversight path here. The filter is server-side on
    // purpose: a non-eligible member's response contains no trace of the channel — no locked teaser,
    // no absence state (the spec's no-shaming rule).
    const [config, eligible] = await Promise.all([
      getContributorAccessConfig(),
      isMemberEligible(gate.auth.userId),
    ]);
    if (config.channelOpen && (eligible || gate.auth.isAdmin)) {
      response.channels.push({
        slug: GATED_CHANNEL_SLUG,
        displayName: GATED_CHANNEL_DISPLAY_NAME,
        visibilityScope: 'eligible',
        streamChannelId: GATED_STREAM_CHANNEL_ID,
      });
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'hub', op: 'channels' });
    return NextResponse.json(
      {
        ok: false,
        message: 'Unable to read Hub channels.',
      },
      { status: 503 },
    );
  }
}
