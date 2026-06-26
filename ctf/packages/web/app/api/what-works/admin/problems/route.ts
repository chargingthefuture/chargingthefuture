import { NextResponse } from 'next/server';
import { createProblem, listAdminProblems } from 'lib/what-works/repository';
import { MAX_EMOJI_LENGTH, MAX_PROBLEM_CONTEXT_LENGTH, MAX_PROBLEM_TITLE_LENGTH } from 'lib/what-works/constants';
import {
  ensureMutationCsrf,
  parseJsonBody,
  readTrimmedString,
  requireWhatWorksAdminAccess,
  whatWorksError,
} from '../../_lib';
import { logWhatWorksAudit } from 'lib/what-works/audit';

export async function GET() {
  const gate = await requireWhatWorksAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const problems = await listAdminProblems();
  logWhatWorksAudit({
    actorId: gate.auth.userId,
    command: 'what-works.admin.problem.list',
    status: 'allow',
    reason: 'admin_route_guard',
    targetType: 'problem',
    targetId: 'all',
    result: 'success',
    errorCategory: null,
  });
  return NextResponse.json({ ok: true, problems });
}

export async function POST(request: Request) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) {
    return csrf;
  }
  const gate = await requireWhatWorksAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return whatWorksError('Invalid JSON body.', 'what_works_invalid_body', 400);
  }

  const title = readTrimmedString(body.title);
  const emoji = readTrimmedString(body.emoji) ?? '';
  const context = readTrimmedString(body.context) ?? '';
  const sortOrderRaw = body.sortOrder;
  const sortOrder = typeof sortOrderRaw === 'number' && Number.isFinite(sortOrderRaw) ? Math.trunc(sortOrderRaw) : 0;

  if (!title) {
    return whatWorksError('Add a problem title.', 'what_works_title_required', 400);
  }
  if (title.length > MAX_PROBLEM_TITLE_LENGTH) {
    return whatWorksError('Problem title is too long.', 'what_works_title_too_long', 400);
  }
  if (context.length > MAX_PROBLEM_CONTEXT_LENGTH) {
    return whatWorksError('Problem context is too long.', 'what_works_context_too_long', 400);
  }
  if (emoji.length > MAX_EMOJI_LENGTH) {
    return whatWorksError('Emoji is invalid.', 'what_works_emoji_invalid', 400);
  }

  const problem = await createProblem({
    title,
    emoji,
    context,
    sortOrder,
    createdBy: gate.auth.userId,
  });
  logWhatWorksAudit({
    actorId: gate.auth.userId,
    command: 'what-works.admin.problem.create',
    status: 'allow',
    reason: 'admin_route_guard',
    targetType: 'problem',
    targetId: problem.id,
    result: 'success',
    errorCategory: null,
  });
  return NextResponse.json({ ok: true, problem }, { status: 201 });
}
