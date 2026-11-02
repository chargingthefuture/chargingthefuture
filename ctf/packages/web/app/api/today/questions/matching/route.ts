import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireQuestionsAccess } from 'lib/questions/_lib';
import { readMatchingState, setMatchingEnabled } from 'lib/questions/repository';
import { checkRateLimit } from 'lib/security/rate-limit';
import { reportError } from 'lib/observability/report';

// GET and POST /api/today/questions/matching: whether the member is matched in 21 Questions, and how
// many questions they answered (the toggle shows from the first answer). POST { enabled } is the
// only way to change it; answering never does. Off takes the member out of every match from the next
// read, theirs and everyone else's, and keeps their answers.

export const dynamic = 'force-dynamic';

const CHANGES_PER_MINUTE = 20;
const NO_STORE = { 'cache-control': 'private, no-store' };

function failed(op: string, error: unknown, message: string) {
  reportError(error, { area: 'questions', op });
  return NextResponse.json({ ok: false, code: 'questions_unavailable', message }, { status: 503 });
}

export async function GET() {
  const gate = await requireQuestionsAccess();
  if (!gate.allowed) return gate.response;
  try {
    const state = await readMatchingState(gate.auth.userId);
    return NextResponse.json({ ok: true, ...state }, { headers: NO_STORE });
  } catch (error) {
    return failed('read_matching', error, 'Matching could not be read: the database read failed.');
  }
}

export async function POST(request: Request) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireQuestionsAccess();
  if (!gate.allowed) return gate.response;
  const userId = gate.auth.userId;

  const limit = checkRateLimit(`questions:matching:${userId}`, CHANGES_PER_MINUTE, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', message: 'Too many changes in a minute. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ ok: false, code: 'invalid_matching', message: 'Send enabled: true or false.' }, { status: 400 });
  }
  try {
    await setMatchingEnabled(userId, body.enabled);
    const state = await readMatchingState(userId);
    return NextResponse.json({ ok: true, ...state }, { headers: NO_STORE });
  } catch (error) {
    return failed('set_matching', error, 'Matching was not changed: the database write failed. Try again.');
  }
}
