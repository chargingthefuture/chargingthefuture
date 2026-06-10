import { NextResponse } from 'next/server';
import {
  contributionsErrorResponse,
  ensureMutationCsrf,
  requireContributionsUserAccess,
} from '../../_lib';
import { dismissBanner } from 'lib/contributions/repository';

// Dismissing the fundraiser banner silently snoozes it (length is an internal config knob).
// Deliberately NOT audited and the snooze horizon is not returned to the member.
export async function POST(request: Request) {
  const gate = await requireContributionsUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    await dismissBanner(gate.auth.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return contributionsErrorResponse(error, 'Banner dismissal unavailable.', 'banner_dismiss');
  }
}
