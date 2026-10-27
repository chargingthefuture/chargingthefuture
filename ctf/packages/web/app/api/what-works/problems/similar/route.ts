import { NextResponse } from 'next/server';
import { findSimilarProblems } from 'lib/what-works/problem-review';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';
import { requireWhatWorksAccess, whatWorksError } from '../../_lib';

// GET /api/what-works/problems/similar?q=: up to five listed problems that share words with what a
// member is typing, so they can add to one instead of proposing a duplicate.
export async function GET(request: Request) {
  const gate = await requireWhatWorksAccess();
  if (!gate.allowed) return gate.response;
  const q = (new URL(request.url).searchParams.get('q') ?? '').slice(0, 120);
  try {
    return NextResponse.json({ ok: true, problems: await findSimilarProblems(q) });
  } catch (error) {
    reportError(error, { area: 'what-works', op: 'problems_similar' });
    return whatWorksError(`Similar problems could not be read: ${failureReason(error)}`, 'what_works_similar_failed', 503);
  }
}
