import { NextResponse } from 'next/server';
import { listActiveProblems } from 'lib/what-works/repository';
import { requireWhatWorksAccess, whatWorksError } from '../_lib';
import { logWhatWorksAudit } from 'lib/what-works/audit';
import { reportError } from 'lib/observability/report';

// Active problems for the suggest form. Members may only attach a tool to an existing
// problem; new problems are admin-curated to avoid duplicate categories.
export async function GET() {
  const gate = await requireWhatWorksAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  try {
    const problems = await listActiveProblems();
    logWhatWorksAudit({
      actorId: gate.auth.userId,
      command: 'what-works.problems.list',
      status: 'allow',
      reason: 'access_route_guard',
      targetType: 'problem',
      targetId: 'active',
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({
      ok: true,
      problems: problems.map((problem) => ({
        id: problem.id,
        slug: problem.slug,
        emoji: problem.emoji,
        title: problem.title,
        context: problem.context,
      })),
    });
  } catch (error) {
    reportError(error, { area: 'what-works', op: 'problems' });
    return whatWorksError('Problems are unavailable right now.', 'what_works_problems_unavailable', 500);
  }
}
