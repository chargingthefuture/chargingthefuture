import { NextRequest, NextResponse } from 'next/server';
import { ensureMutationCsrf, peerProgrammingErrorResponse, requirePeerProgrammingAdminAccess } from 'lib/peer-programming/_lib';
import { getPublishedWeeklyTopic, insertPeerProgrammingAudit, upsertWeeklyTopic } from 'lib/peer-programming/repository';
import { reportError } from 'lib/observability/report';

type TopicBody = {
  weekStartDate?: string;
  title?: string;
  guidance?: string;
  revisionNote?: string | null;
  publish?: boolean;
};

export async function GET() {
  const gate = await requirePeerProgrammingAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const topic = await getPublishedWeeklyTopic();
    return NextResponse.json({ ok: true, topic }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'admin_topics' });
    return peerProgrammingErrorResponse(error, 'Topic retrieval unavailable.');
  }
}

export async function PUT(request: NextRequest) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requirePeerProgrammingAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: TopicBody;
  try {
    body = (await request.json()) as TopicBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'peer_programming_invalid_json', message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.weekStartDate || !body.title || !body.guidance) {
    return NextResponse.json({ ok: false, code: 'peer_programming_invalid_payload', message: 'weekStartDate, title, and guidance are required.' }, { status: 400 });
  }

  // The week key must be the Monday of the target week in YYYY-MM-DD form — room loads look the
  // topic up by getWeekStartDate(), which always produces a Monday, so a topic saved under any
  // other date would never be found. This is the contract's invalid_week_key deny condition.
  const weekKeyMatch = /^\d{4}-\d{2}-\d{2}$/.test(body.weekStartDate);
  const parsedWeekStart = new Date(`${body.weekStartDate}T00:00:00Z`);
  if (!weekKeyMatch || Number.isNaN(parsedWeekStart.getTime()) || parsedWeekStart.getUTCDay() !== 1) {
    return NextResponse.json(
      { ok: false, code: 'peer_programming_invalid_week_key', message: 'weekStartDate must be the Monday of the target week, as YYYY-MM-DD.' },
      { status: 400 },
    );
  }

  try {
    const topic = await upsertWeeklyTopic({
      actorId: gate.auth.userId,
      weekStartDate: body.weekStartDate,
      title: body.title,
      guidance: body.guidance,
      revisionNote: body.revisionNote ?? null,
      publish: Boolean(body.publish),
    });

    await insertPeerProgrammingAudit({
      actorId: gate.auth.userId,
      command: 'peer-programming.topic.upsert',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'topic',
      targetId: topic.id,
      metadata: { publish: Boolean(body.publish) },
    });

    return NextResponse.json({ ok: true, topic }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'peer-programming', op: 'admin_topics' });
    return peerProgrammingErrorResponse(error, 'Topic upsert unavailable.');
  }
}
