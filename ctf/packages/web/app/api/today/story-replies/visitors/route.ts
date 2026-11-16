import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { ensureMutationCsrf, rateLimited, readJson } from 'lib/today/cards/access';
import { readStoryRepliesVisitors, setStoryRepliesVisitors } from 'lib/today/story-replies-visitors';
import { reportError } from 'lib/observability/report';

// GET and POST /api/today/story-replies/visitors: whether visitors without an account may read what
// this member writes in the conversation on members' stories (owner decision, 2026-11-16), set in
// Settings. POST { agreed } records it with the version of the words and the time, or clears both;
// off hides their replies from visitors from the next read. Approved members only (the default
// tier): visitors only ever see an approved member's replies.

export const dynamic = 'force-dynamic';

const CHANGES_PER_MINUTE = 20;
const NO_STORE = { 'cache-control': 'private, no-store' };

async function gate() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) return { allowed: false as const, response: NextResponse.json(decision, { status: decision.status }) };
  return { allowed: true as const, userId: decision.userId };
}

function failed(op: string, error: unknown, message: string) {
  reportError(error, { area: 'today', op });
  return NextResponse.json({ ok: false, code: 'story_replies_unavailable', message }, { status: 503 });
}

export async function GET() {
  const access = await gate();
  if (!access.allowed) return access.response;
  try {
    return NextResponse.json({ ok: true, ...(await readStoryRepliesVisitors(access.userId)) }, { headers: NO_STORE });
  } catch (error) {
    return failed('story_replies_visitors_read', error, 'The setting could not be read: the database read failed.');
  }
}

export async function POST(request: Request) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const access = await gate();
  if (!access.allowed) return access.response;
  const limited = rateLimited(`today:story-replies-visitors:${access.userId}`, CHANGES_PER_MINUTE, 60_000, 'Too many changes in a minute. Try again shortly.');
  if (limited) return limited;
  const body = await readJson(request);
  if (typeof body?.agreed !== 'boolean') {
    return NextResponse.json({ ok: false, code: 'invalid_story_replies_visitors', message: 'Send agreed: true or false.' }, { status: 400 });
  }
  try {
    await setStoryRepliesVisitors(access.userId, body.agreed);
    return NextResponse.json({ ok: true, ...(await readStoryRepliesVisitors(access.userId)) }, { headers: NO_STORE });
  } catch (error) {
    return failed('story_replies_visitors_set', error, 'The setting was not changed: the database write failed. Try again.');
  }
}
