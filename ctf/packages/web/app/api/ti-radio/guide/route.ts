import { NextResponse } from 'next/server';
import { isUserUnlocked } from 'lib/shared/unlock-interface';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { TI_RADIO_ERROR_CODE } from 'lib/ti-radio/constants';
import { readerIdentity } from 'lib/ti-radio/_lib';
import { getGuide } from 'lib/ti-radio/repository';

export const dynamic = 'force-dynamic';

// GET /api/ti-radio/guide — the whole schedule, open to anyone including signed-out visitors.
//
// No gate at all, deliberately. A broadcast guide nobody can read is not a guide, and this one is
// written for people arriving from a Quora space who have no account yet. What comes back is what a
// guide prints: times, hosts' handles, and what each discussion is about. Nothing about a host
// beyond the handle they publish under, and nothing about who is listening.
export async function GET() {
  try {
    const reader = await readerIdentity();
    const canHost = reader.userId ? await isUserUnlocked(reader.userId).catch(() => false) : false;
    const guide = await getGuide({ userId: reader.userId, canHost: canHost || reader.isAdmin, isAdmin: reader.isAdmin });
    return NextResponse.json({ ok: true, guide }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'ti-radio', op: 'guide_read' });
    return NextResponse.json(
      {
        ok: false,
        code: TI_RADIO_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to load the guide.',
        reason: failureReason(error),
      },
      { status: 503 },
    );
  }
}
