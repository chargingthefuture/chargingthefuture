import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { getChymeQuotaPolicy, getPublicRoomLiveState } from 'lib/chyme/repository';
import { getStreamVideoUsageSummary } from 'lib/stream-quota/usage';
import { chymeMaxGuestListeners, chymeMaxParticipants, chymeRedBandMaxParticipants, streamVideoMinutesBudget } from 'lib/stream-quota/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { requireChymeAdminAccess } from '../../_lib';

// GET /api/chyme/admin/stream-usage — the Stream Video minute meter, for the Chyme admin screen.
//
// Read-only and admin-only. Month-to-date participant-minutes against the budget, the band that
// puts the room under, what the policy is doing about it right now, the per-surface and per-day
// breakdown, who is in the main room this minute, and the caps in force. The numbers are the app's
// own estimate from the presence heartbeats; the Stream dashboard is the bill of record.
export async function GET() {
  const gate = await requireChymeAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const [usage, policy, room] = await Promise.all([getStreamVideoUsageSummary(), getChymeQuotaPolicy(), getPublicRoomLiveState()]);
    return NextResponse.json(
      {
        ok: true,
        usage,
        policy,
        room: {
          roomName: room.roomName,
          isLive: room.callActive,
          participantCount: room.participantCount,
          guestCount: room.guestCount,
        },
        config: {
          budgetMinutes: streamVideoMinutesBudget(),
          maxParticipants: chymeMaxParticipants(),
          maxGuestListeners: chymeMaxGuestListeners(),
          redBandMaxParticipants: chymeRedBandMaxParticipants(),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'admin_stream_usage' });
    return NextResponse.json(
      {
        ok: false,
        code: CHYME_ERROR_CODE.persistenceUnavailable,
        message: `Unable to read the Stream usage meter: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
