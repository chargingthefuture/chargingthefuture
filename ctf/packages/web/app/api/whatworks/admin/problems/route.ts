import { NextResponse } from 'next/server';
import { createProblem, listAdminProblems } from 'lib/whatworks/repository';
import { MAX_EMOJI_LENGTH, MAX_PROBLEM_CONTEXT_LENGTH, MAX_PROBLEM_TITLE_LENGTH } from 'lib/whatworks/constants';
import {
  ensureMutationCsrf,
  parseJsonBody,
  readTrimmedString,
  requireWhatWorksAdminAccess,
  whatworksError,
} from '../../_lib';

export async function GET() {
  const gate = await requireWhatWorksAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const problems = await listAdminProblems();
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
    return whatworksError('Invalid JSON body.', 'whatworks_invalid_body', 400);
  }

  const title = readTrimmedString(body.title);
  const emoji = readTrimmedString(body.emoji) ?? '';
  const context = readTrimmedString(body.context) ?? '';
  const sortOrderRaw = body.sortOrder;
  const sortOrder = typeof sortOrderRaw === 'number' && Number.isFinite(sortOrderRaw) ? Math.trunc(sortOrderRaw) : 0;

  if (!title) {
    return whatworksError('Add a problem title.', 'whatworks_title_required', 400);
  }
  if (title.length > MAX_PROBLEM_TITLE_LENGTH) {
    return whatworksError('Problem title is too long.', 'whatworks_title_too_long', 400);
  }
  if (context.length > MAX_PROBLEM_CONTEXT_LENGTH) {
    return whatworksError('Problem context is too long.', 'whatworks_context_too_long', 400);
  }
  if (emoji.length > MAX_EMOJI_LENGTH) {
    return whatworksError('Emoji is invalid.', 'whatworks_emoji_invalid', 400);
  }

  const problem = await createProblem({
    title,
    emoji,
    context,
    sortOrder,
    createdBy: gate.auth.userId,
  });
  return NextResponse.json({ ok: true, problem }, { status: 201 });
}
