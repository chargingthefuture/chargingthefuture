import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from '../../auth/server-authz';
import { checkMutationOrigin } from '../../auth/csrf';
import { getAccountRestrictionStatus } from '../../auth/account-restrictions';
import { isBlockedBetween } from '../../blocks/repository';
import { checkRateLimit } from '../../security/rate-limit';
import { reportError } from '../../observability/report';
import { readCardId } from './ids';

// Card conversations on Today are for approved members (the default tier), like the rest of Today's
// writing: an answer or a message reaches other members, and Just us two is a conversation between
// two people. A member who is not approved yet gets the refusal with reason unlock_required, and
// the sheet shows the card read-only with one line saying writing opens once Unlock is done.
export async function requireCardsAccess() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true as const, auth: decision };
}

export function cardsDenied(code: string, message: string, status = 403) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') return cardsDenied('cards_denied', 'Missing CSRF confirmation header.');
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') return cardsDenied('cards_denied', 'Invalid request origin metadata.');
  if (originCheck === 'cross_origin') return cardsDenied('cards_denied', 'Cross-origin mutation denied by CSRF policy.');
  return null;
}

export async function cardIdFrom(context: { params: Promise<{ cardId: string }> }): Promise<string | null> {
  const { cardId } = await context.params;
  return readCardId(cardId);
}

export function invalidCard() {
  return cardsDenied('invalid_card', 'That is not a card id: a card id is a source name, a colon, then the item id (up to 200 characters).', 400);
}

// The writer restricted from contact, or a block either way between the two, refuses the write.
// The same check 21 Questions makes before a message; a block also hides each from the other here.
export async function ensureCanContact(userId: string, otherId: string | null): Promise<NextResponse | null> {
  const status = await getAccountRestrictionStatus(userId, 'contact');
  if (status.isRestricted) {
    return cardsDenied('contact_restricted', 'Your account is restricted from contacting other members, so nothing can be written in a card.');
  }
  if (otherId && (await isBlockedBetween(userId, otherId))) {
    return cardsDenied('blocked', 'This cannot be sent: one of you has blocked the other.');
  }
  if (otherId && (await getAccountRestrictionStatus(otherId, 'contact')).isRestricted) {
    return cardsDenied('contact_restricted', 'This member cannot be contacted right now.');
  }
  return null;
}

export function rateLimited(key: string, max: number, windowMs: number, message: string): NextResponse | null {
  const limit = checkRateLimit(key, max, windowMs);
  if (limit.allowed) return null;
  return NextResponse.json(
    { ok: false, code: 'rate_limited', message },
    { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
  );
}

export function cardsFailed(op: string, error: unknown, message: string) {
  reportError(error, { area: 'today-cards', op });
  return NextResponse.json({ ok: false, code: 'cards_unavailable', message }, { status: 503 });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const body = (await request.json().catch(() => null)) as unknown;
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
}

export function readAccountId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : null;
}
