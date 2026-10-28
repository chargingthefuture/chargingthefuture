import { NextResponse } from 'next/server';
import { listPendingProblems } from 'lib/what-works/problem-review';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';
import { requireWhatWorksAdminAccess, whatWorksError } from '../../../_lib';

// GET /api/what-works/admin/problems/pending: problems members proposed, oldest first, for review.
// Who proposed each one is not part of the answer.
export async function GET() {
  const gate = await requireWhatWorksAdminAccess();
  if (!gate.allowed) return gate.response;
  try {
    return NextResponse.json({ ok: true, problems: await listPendingProblems() });
  } catch (error) {
    reportError(error, { area: 'what-works', op: 'admin_problems_pending' });
    return whatWorksError(`Proposed problems could not be read: ${failureReason(error)}`, 'what_works_pending_failed', 503);
  }
}
