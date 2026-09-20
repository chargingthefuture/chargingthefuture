import { NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { withDbTransaction } from 'lib/db/postgres';
import { listMissionsForAdmin } from 'lib/skills-hunt/missions';
import { getRound, insertSkillsHuntAudit } from 'lib/skills-hunt/repository';
import { buildMissionPosterView } from 'lib/skills-hunt/mission-poster-view';
import {
  MISSION_POSTER_WIDTH,
  buildMissionPosterElement,
  estimateMissionPosterHeight,
} from 'lib/skills-hunt/mission-poster-image';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { reportError } from 'lib/observability/report';
import { requireSkillsHuntAdminAccess } from '../../../../../_lib';

// A round's active missions drawn as one tall PNG, for posting somewhere that takes a picture.
//
// The missions screen is taller than a phone, so getting a clean picture of it by hand means
// scrolling, taking several screenshots and stitching them together — which loses cards at the
// seams and leaves the app's own top bar, clock and battery in the middle of something meant to be
// seen in public. This draws the list once, in order, at a size that stays readable when it is
// resized down.
//
// Admin-only (owner decision, 2026-09-20). It is a way to advertise the round, not a member
// feature, and it carries the round's missions rather than any one member's progress — see
// mission-poster-view.ts for why no progress is in the picture.
//
// Answered as a file download, the same way the ClickLog report image is: shown in the browser
// instead, the response is a bare picture with no page around it and no way back to the missions
// screen. Saving the file leaves the screen where it was, and the saved file shares like any photo.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const gate = await requireSkillsHuntAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { roundId } = await params;

  try {
    const round = await getRound(roundId);
    if (!round) {
      return NextResponse.json(
        { ok: false, code: SKILLS_HUNT_ERROR_CODE.roundNotFound, message: 'Round not found.' },
        { status: 404 },
      );
    }

    const missions = await withDbTransaction((client) => listMissionsForAdmin(client, roundId));
    const view = buildMissionPosterView(round, missions);
    const generatedOn = new Date().toISOString().slice(0, 10);

    await insertSkillsHuntAudit({
      actorId: gate.auth.userId,
      command: 'skills-hunt.mission.image',
      policyStatus: 'allow',
      reason: 'admin_route_guard',
      targetType: 'round',
      targetId: roundId,
      metadata: { missionsDrawn: view.missions.length },
    });

    return new ImageResponse(buildMissionPosterElement(view, generatedOn), {
      width: MISSION_POSTER_WIDTH,
      height: estimateMissionPosterHeight(view),
      headers: {
        'Content-Disposition': `attachment; filename="skillshunt-missions-${generatedOn}.png"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'admin_rounds_roundid_missions_image' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to draw the missions picture.' },
      { status: 503 },
    );
  }
}
