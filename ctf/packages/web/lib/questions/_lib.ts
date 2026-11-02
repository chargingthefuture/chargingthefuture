import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from '../auth/server-authz';
import { checkMutationOrigin } from '../auth/csrf';
import { getAccountRestrictionStatus } from '../auth/account-restrictions';

// 21 Questions is for approved members (the default tier): a match leads to a conversation between
// two people, so both have been through Unlock.
export async function requireQuestionsAccess() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true as const, auth: decision };
}

function denied(message: string, status = 403) {
  return NextResponse.json({ ok: false, code: 'questions_denied', message }, { status });
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') return null;
  if (request.headers.get('x-ctf-csrf') !== '1') return denied('Missing CSRF confirmation header.');
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') return denied('Invalid request origin metadata.');
  if (originCheck === 'cross_origin') return denied('Cross-origin mutation denied by CSRF policy.');
  return null;
}

// A member restricted from contact cannot start or continue a match conversation.
export async function ensureCanContact(userId: string): Promise<NextResponse | null> {
  const status = await getAccountRestrictionStatus(userId, 'contact');
  return status.isRestricted ? denied('Your account is restricted from contacting other members, so messages cannot be sent.') : null;
}
