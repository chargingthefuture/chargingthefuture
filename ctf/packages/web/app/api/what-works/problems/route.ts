import { NextResponse } from 'next/server';
import { listActiveProblems } from 'lib/what-works/repository';
import { proposeProblem, ProposalLimitError } from 'lib/what-works/problem-review';
import { MAX_PROBLEM_CONTEXT_LENGTH, MAX_PROBLEM_TITLE_LENGTH } from 'lib/what-works/constants';
import { failureReason } from 'lib/errors/failure';
import { ensureMutationCsrf, parseJsonBody, readTrimmedString, requireWhatWorksAccess, whatWorksError } from '../_lib';
import { logWhatWorksAudit } from 'lib/what-works/audit';
import { reportError } from 'lib/observability/report';

// Approved, active problems for the suggest form. A member who finds none that fits proposes one
// (POST below); it waits for review, and duplicates are merged into the problem already listed.
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

function readProposal(body: Record<string, unknown>): { error: NextResponse } | { title: string; context: string } {
  const title = readTrimmedString(body.title);
  const context = readTrimmedString(body.context) ?? '';
  if (!title) return { error: whatWorksError('Say what the problem is.', 'what_works_title_required', 400) };
  if (title.length > MAX_PROBLEM_TITLE_LENGTH) return { error: whatWorksError('Problem title is too long.', 'what_works_title_too_long', 400) };
  if (context.length > MAX_PROBLEM_CONTEXT_LENGTH) return { error: whatWorksError('Problem context is too long.', 'what_works_context_too_long', 400) };
  return { title, context };
}

// A member proposes a problem. It waits for an admin, who approves it, merges it into one already
// listed, or deletes it as spam. Who proposed it is kept only to cap waiting proposals at three.
export async function POST(request: Request) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireWhatWorksAccess();
  if (!gate.allowed) return gate.response;
  const body = await parseJsonBody(request);
  if (!body) return whatWorksError('Invalid JSON body.', 'what_works_invalid_body', 400);
  const proposal = readProposal(body);
  if ('error' in proposal) return proposal.error;
  try {
    const { id } = await proposeProblem({ ...proposal, userId: gate.auth.userId });
    logWhatWorksAudit({
      actorId: gate.auth.userId,
      command: 'what-works.problem.propose',
      status: 'allow',
      reason: 'access_route_guard',
      targetType: 'problem',
      targetId: id,
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, problemId: id, status: 'pending' }, { status: 201 });
  } catch (error) {
    if (error instanceof ProposalLimitError) return whatWorksError(error.message, 'what_works_proposal_limit', 429);
    reportError(error, { area: 'what-works', op: 'problem_propose' });
    return whatWorksError(`The problem could not be saved: ${failureReason(error)}`, 'what_works_propose_failed', 503);
  }
}
