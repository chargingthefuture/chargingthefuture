import { NextResponse } from 'next/server';
import { requirePeerProgrammingReadAccess, peerProgrammingErrorResponse } from 'lib/peer-programming/_lib';
import { getMyCohort, getPublishedWeeklyTopic, listMessages } from 'lib/peer-programming/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  const gate = await requirePeerProgrammingReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const [topic, cohort] = await Promise.all([
      getPublishedWeeklyTopic(),
      getMyCohort(gate.auth.userId),
    ]);

    const messages = cohort ? await listMessages(cohort.id) : [];

    return NextResponse.json({
      ok: true,
      topic,
      cohort,
      messages,
      fallbackOpen: cohort?.fallbackOpen ?? true,
    });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'room' });
    return peerProgrammingErrorResponse(error, 'Peer programming room unavailable.');
  }
}
