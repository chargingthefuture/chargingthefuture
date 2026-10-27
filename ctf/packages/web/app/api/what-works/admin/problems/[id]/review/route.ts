import { NextResponse } from 'next/server';
import { approveProblem, deleteSpamProblem, mergeProblem } from 'lib/what-works/problem-review';
import { recordWhatWorksAdminAudit } from 'lib/what-works/audit';
import {
  ensureMutationCsrf,
  parseJsonBody,
  readTrimmedString,
  requireWhatWorksAdminAccess,
  runAuditedWhatWorksAdminMutation,
  whatWorksError,
} from '../../../../_lib';

type RouteContext = { params: Promise<{ id: string }> };
type Action = 'approve' | 'merge' | 'spam';

// POST /api/what-works/admin/problems/[id]/review { action: 'approve' | 'merge' | 'spam', intoId? }
// Approve as new, merge into a listed problem (its suggestions move there), or delete as spam. Only
// a problem still waiting for review can be acted on.
async function runReview(id: string, action: Action, intoId: string | null): Promise<boolean> {
  if (action === 'approve') return approveProblem(id);
  if (action === 'spam') return deleteSpamProblem(id);
  return intoId ? mergeProblem(id, intoId) : false;
}

async function reviewFromRequest(request: Request, id: string, actorId: string, command: string): Promise<NextResponse> {
  const body = await parseJsonBody(request);
  if (!body) return whatWorksError('Invalid JSON body.', 'what_works_invalid_body', 400);
  const action = body.action;
  if (action !== 'approve' && action !== 'merge' && action !== 'spam') {
    return whatWorksError('Choose approve, merge or spam.', 'what_works_review_action_invalid', 400);
  }
  const intoId = readTrimmedString(body.intoId);
  if (action === 'merge' && !intoId) return whatWorksError('Choose the problem to merge into.', 'what_works_merge_target_required', 400);
  const done = await runReview(id, action, intoId);
  if (!done) {
    return whatWorksError('That proposal is not waiting for review, or the problem to merge into is not on the list.', 'what_works_review_not_found', 404);
  }
  await recordWhatWorksAdminAudit({
    actorId,
    command,
    status: 'allow',
    reason: 'admin_route_guard',
    targetType: 'problem',
    targetId: id,
    result: 'success',
    errorCategory: null,
    metadata: { action, intoId },
  });
  return NextResponse.json({ ok: true, action });
}

export async function POST(request: Request, context: RouteContext) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const { id } = await context.params;
  const target = { command: 'what-works.admin.problem.review', targetType: 'problem', targetId: id };
  const gate = await requireWhatWorksAdminAccess(target);
  if (!gate.allowed) return gate.response;
  const actorId = gate.auth.userId;
  return runAuditedWhatWorksAdminMutation(actorId, target, () => reviewFromRequest(request, id, actorId, target.command));
}
