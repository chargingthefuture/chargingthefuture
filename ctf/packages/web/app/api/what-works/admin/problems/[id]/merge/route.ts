import { NextResponse } from 'next/server';
import { mergeApprovedProblems } from 'lib/what-works/problem-review';
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/what-works/admin/problems/[id]/merge { intoId }
// Merge two problems already on the list: every thing that helped under [id], with every vote on
// it, moves to intoId, then [id] is removed.
async function mergeFromRequest(request: Request, id: string, actorId: string, command: string): Promise<NextResponse> {
  const body = await parseJsonBody(request);
  if (!body) return whatWorksError('Invalid JSON body.', 'what_works_invalid_body', 400);
  const intoId = readTrimmedString(body.intoId);
  if (!intoId || !UUID.test(intoId) || !UUID.test(id)) {
    return whatWorksError('Choose the problem to merge into.', 'what_works_merge_target_required', 400);
  }
  if (intoId === id) return whatWorksError('A problem cannot be merged into itself.', 'what_works_merge_same', 400);
  const merged = await mergeApprovedProblems(id, intoId);
  if (!merged) {
    return whatWorksError('One of the two problems is no longer on the list. Reload and choose again.', 'what_works_merge_not_found', 404);
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
    metadata: { intoId, moved: merged.moved },
  });
  return NextResponse.json({ ok: true, intoId, moved: merged.moved });
}

export async function POST(request: Request, context: RouteContext) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const { id } = await context.params;
  const target = { command: 'what-works.admin.problem.merge', targetType: 'problem', targetId: id };
  const gate = await requireWhatWorksAdminAccess(target);
  if (!gate.allowed) return gate.response;
  const actorId = gate.auth.userId;
  return runAuditedWhatWorksAdminMutation(actorId, target, () => mergeFromRequest(request, id, actorId, target.command));
}
