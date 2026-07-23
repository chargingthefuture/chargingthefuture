import { NextResponse } from 'next/server';
import { requirePeerProgrammingReadAccess, peerProgrammingErrorResponse } from 'lib/peer-programming/_lib';
import { PEER_PROGRAMMING_ROOM_ROSTER_LIMIT } from 'lib/peer-programming/constants';
import {
  getCohortById,
  getMyCohort,
  getPublishedWeeklyTopic,
  isCohortMember,
  joinStandingCohort,
  listActiveCohorts,
  listMessages,
} from 'lib/peer-programming/repository';
import { buildCohortRosters, type CohortMember } from 'lib/peer-programming/roster';
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
    // Opening the room auto-joins the caller to the single standing cohort (single-open mode only) so
    // any authorized member can post, not just listen. This membership WRITE is done here, after the
    // access gate above, rather than inside getMyCohort (a read) — no-op in weekly mode.
    await joinStandingCohort(gate.auth.userId);

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
    // Who is in the open cohort, with resolved usernames, so members (and listeners) can see who
    // their cohort-mates are. Membership is not secret. Empty when no cohort is open.
    //
    // The roster is best-effort and must never blank the room: each name is resolved via an external
    // Clerk lookup, so if that is slow or fails the room still renders with an empty roster rather
    // than the whole page failing. It is also capped (PEER_PROGRAMMING_ROOM_ROSTER_LIMIT) because the
    // standing cohort can hold every active member; the true total still shows as the member count.
    let members: CohortMember[] = [];
    if (cohort) {
      try {
        members = (await buildCohortRosters([cohort.id], PEER_PROGRAMMING_ROOM_ROSTER_LIMIT)).get(cohort.id) ?? [];
      } catch (rosterError) {
        reportError(rosterError, { area: 'peer-programming', op: 'room_roster' });
        members = [];
      }
    }

    return NextResponse.json({
      ok: true,
      topic,
      cohort,
      members,
      messages,
      // The full set of running cohorts for the week so the room can show "listen in on a running
      // cohort" to a member who was not placed here, and so an admin can reach every cohort.
      cohorts,
      myCohortId: myCohort?.id ?? null,
      access,
      isMember: access === 'member',
      fallbackOpen: cohort?.fallbackOpen ?? true,
      // An ended cohort is read-only: the client hides the composer and shows an "ended" notice, and
      // the message/reply routes reject posting to it server-side.
      ended: cohort ? cohort.status === 'ended' : false,
    });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'room' });
    return peerProgrammingErrorResponse(error, 'PeerProgramming room unavailable.');
  }
}
