import { NextResponse } from 'next/server';
import { listActiveProblems } from 'lib/whatworks/repository';
import { requireWhatWorksAccess, whatworksError } from '../_lib';
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
    reportError(error, { area: 'whatworks', op: 'problems' });
    return whatworksError('Problems are unavailable right now.', 'whatworks_problems_unavailable', 500);
  }
}
