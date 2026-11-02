import { NextResponse } from 'next/server';
import { SE_MATCH_MESSAGE_MAX, seMatchLine } from '@ctf/shared';
import { ensureCanContact, ensureMutationCsrf, requireQuestionsAccess } from 'lib/questions/_lib';
import { findMatch, readConversation, sendMessage } from 'lib/questions/repository';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { notifySafe } from 'lib/notifications/repository';
import { checkRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';

// GET and POST /api/today/questions/matches/[accountId]/messages: the conversation inside a 21
// Questions match card. Only between two members who are a match right now: answered at least three
// the same, neither has blocked the other, and neither is restricted from contact. Reading marks the
// other person's messages read; sending tells them in Activity.

export const dynamic = 'force-dynamic';

const MESSAGES_PER_HOUR = 60;

type Context = { params: Promise<{ accountId: string }> };

function notMatched() {
  return NextResponse.json(
    { ok: false, code: 'not_a_match', message: 'This conversation is not open: you are not a match with this member right now.' },
    { status: 404 },
  );
}

function failed(op: string, error: unknown, message: string) {
  reportError(error, { area: 'questions', op });
  return NextResponse.json({ ok: false, code: 'questions_unavailable', message }, { status: 503 });
}

export async function GET(_request: Request, context: Context) {
  const gate = await requireQuestionsAccess();
  if (!gate.allowed) return gate.response;
  const { accountId } = await context.params;
  try {
    if (!(await findMatch(gate.auth.userId, accountId))) return notMatched();
    const messages = await readConversation(gate.auth.userId, accountId);
    return NextResponse.json({ ok: true, messages }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return failed('read_messages', error, 'The conversation could not be read: the database read failed.');
  }
}

async function readMessageBody(request: Request): Promise<string | null> {
  const body = (await request.json().catch(() => null)) as { body?: unknown } | null;
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  return text.length > 0 && text.length <= SE_MATCH_MESSAGE_MAX ? text : null;
}

export async function POST(request: Request, context: Context) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireQuestionsAccess();
  if (!gate.allowed) return gate.response;
  const userId = gate.auth.userId;
  const { accountId } = await context.params;

  const limit = checkRateLimit(`questions:message:${userId}`, MESSAGES_PER_HOUR, 3_600_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', message: 'Too many messages this hour. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  const text = await readMessageBody(request);
  if (!text) {
    return NextResponse.json(
      { ok: false, code: 'invalid_message', message: `A message is 1 to ${SE_MATCH_MESSAGE_MAX} characters.` },
      { status: 400 },
    );
  }
  try {
    const restricted = await ensureCanContact(userId);
    if (restricted) return restricted;
    const match = await findMatch(userId, accountId);
    if (!match) return notMatched();
    const message = await sendMessage(userId, accountId, text);
    const names = await resolveUsernames([userId]);
    await notifySafe({
      userId: accountId,
      sourcePlugin: 'questions',
      notificationType: 'questions.match.message',
      category: 'community',
      summary: `New message from your 21 Questions match. ${seMatchLine({ ...match, handle: names.get(userId) ?? 'a member' })}.`,
      linkPath: '/',
    });
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    return failed('send_message', error, 'The message was not sent: the database write failed. Try again.');
  }
}
