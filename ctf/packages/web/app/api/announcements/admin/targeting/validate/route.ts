import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireFeedAdminAccess } from '../../../../feed/_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { validateAnnouncementTargeting } from 'lib/feed/repository';
import { failureReason } from 'lib/errors/failure';

type TargetingBody = {
  targeting?: unknown;
};

export async function POST(request: Request) {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: TargetingBody;
  try {
    body = (await request.json()) as TargetingBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const result = validateAnnouncementTargeting(body.targeting);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: FEED_ERROR_CODE.invalidPayload,
        message: 'Targeting payload failed validation.',
        targeting: result.normalized,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, targeting: result.normalized }, { status: 200 });
}
