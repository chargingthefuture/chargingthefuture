import { NextResponse } from 'next/server';
import { requireComicAdminAccess } from '../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { listContributionsForReview } from 'lib/comic/contribution-repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

// Admin: the contribution review queue, each row with its entries so the reviewer reads the actual
// writing rather than a count. This is the step the knowledge page promises a contributor — nothing
// they send can reach the assistant without a person passing through here first.
export async function GET(request: Request) {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) return gate.response;

  const status = new URL(request.url).searchParams.get('status') ?? 'pending_review';
  const allowed = ['pending_review', 'accepted', 'declined', 'withdrawn', 'all'];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Unknown status filter.' },
      { status: 400 },
    );
  }

  try {
    const contributions = await listContributionsForReview(status);
    return NextResponse.json({ ok: true, contributions }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'admin_contributions_list' });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: `Could not load contributions: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
