import { NextResponse } from 'next/server';
import { seParseMePrompts, SE_ME_PROMPT_MAX } from '@ctf/shared';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { readMeProfile, saveMePrompts } from 'lib/account/me-profile';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';
import { requireAccountAccess, ensureMutationCsrf } from '../_lib';

// GET /api/account/me: the top of the member's own 3.1 Me screen: since when they have been here,
// their badges and their three profile prompts. Read through the account area like the rest of the
// member's own data. PUT saves the prompts and needs Unlock approval (the default tier): writing is
// doing something, and the account area only lets an unapproved member see and delete their data.

export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireAccountAccess();
  if (!access.allowed) return access.response;
  try {
    const profile = await readMeProfile(access.auth);
    return NextResponse.json({ ok: true, profile }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    reportError(error, { area: 'account', op: 'me_profile_read' });
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.persistenceUnavailable, message: `Could not read your profile: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) return NextResponse.json(decision, { status: decision.status });
  const prompts = seParseMePrompts(await request.json().catch(() => null));
  if (!prompts) {
    return NextResponse.json(
      {
        ok: false,
        code: ACCOUNT_ERROR_CODE.invalidPayload,
        message: `Send canHelpWith, needs and askMeAbout as text of at most ${SE_ME_PROMPT_MAX} characters each.`,
      },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({ ok: true, prompts: await saveMePrompts(decision.userId, prompts) });
  } catch (error) {
    reportError(error, { area: 'account', op: 'me_prompts_write' });
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.persistenceUnavailable, message: `Could not save your lines: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
