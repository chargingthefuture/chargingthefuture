import { NextResponse } from 'next/server';
import { requireSkillsHuntSubmitAccess } from '../_lib';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';
import { checkQuoraUrlForNomination } from 'lib/skills-hunt/nomination-check';
import { checkRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';

// The Scout form asks this as soon as a Quora link is pasted, before the rest of the form is filled
// in: is this person already nominated, or did they ask to be removed? Same gate as submitting, and
// the same two answers the submit route gives, so it tells a scout nothing submitting would not.
// Per-member limit so it cannot be used to walk a list of links; the form asks once per pasted link.
const CHECKS_PER_MINUTE = 30;

export async function GET(request: Request) {
  const gate = await requireSkillsHuntSubmitAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const limit = checkRateLimit(`skills-hunt:nomination-check:${gate.auth.userId}`, CHECKS_PER_MINUTE, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', message: 'Too many link checks. Wait a minute and paste the link again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url).searchParams.get('quoraProfileUrl') ?? '';
  try {
    const result = await checkQuoraUrlForNomination(url);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'skills-hunt', op: 'nomination_check' });
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to check this link right now. You can still submit; the check runs again then.' },
      { status: 503 },
    );
  }
}
