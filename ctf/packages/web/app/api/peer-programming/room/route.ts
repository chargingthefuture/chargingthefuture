import { NextResponse } from 'next/server';
import { requirePeerProgrammingReadAccess, peerProgrammingErrorResponse } from 'lib/peer-programming/_lib';
import {
  getCohortById,
  getMyCohort,
  getPublishedWeeklyTopic,
  isCohortMember,
  listActiveCohorts,
  listMessages,
} from 'lib/peer-programming/repository';
import { reportError } from 'lib/observability/report';

// How the requester relates to the cohort they are viewing:
//   - member:   they were placed in this cohort and can post.
//   - admin:    an admin viewing a cohort they were not placed in, so they can manage it.
//   - listener: any other signed-in member listening in on a running cohort (read-only).
type RoomAccess = 'member' | 'admin' | 'listener';

export async function GET(request: Request) {
  const gate = await requirePeerProgrammingReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestedCohortId = new URL(request.url).searchParams.get('cohortId');

  try {
    const [topic, myCohort, cohorts] = await Promise.all([
      getPublishedWeeklyTopic(),
      getMyCohort(gate.auth.userId),
      listActiveCohorts(),
    ]);

    // Resolve which cohort's room to open. With no ?cohortId the member sees their own cohort
    // (today's behavior). With a ?cohortId an admin or any signed-in member can open another
    // running cohort to listen in — read-only unless they are actually a member of it.
    let cohort = myCohort;
    let access: RoomAccess = myCohort ? 'member' : 'listener';

    if (requestedCohortId) {
      const requested =
        myCohort && myCohort.id === requestedCohortId ? myCohort : await getCohortById(requestedCohortId);
      if (requested) {
        cohort = requested;
        const member = myCohort?.id === requested.id || (await isCohortMember(requested.id, gate.auth.userId));
        access = member ? 'member' : gate.auth.isAdmin ? 'admin' : 'listener';
      }
    }

    const messages = cohort ? await listMessages(cohort.id) : [];

    return NextResponse.json({
      ok: true,
      topic,
      cohort,
      messages,
      // The full set of running cohorts for the week so the room can show "listen in on a running
      // cohort" to a member who was not placed here, and so an admin can reach every cohort.
      cohorts,
      myCohortId: myCohort?.id ?? null,
      access,
      isMember: access === 'member',
      fallbackOpen: cohort?.fallbackOpen ?? true,
    });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'room' });
    return peerProgrammingErrorResponse(error, 'Peer programming room unavailable.');
  }
}
