import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicReadAccess } from '../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { logComicAudit } from 'lib/comic/audit';
import { routeComicMessage, validateComicMessageInput } from 'lib/comic/repository';
import type { ComicMessageInput } from 'lib/comic/types';
import { reportError } from 'lib/observability/report';

type MessageBody = Partial<ComicMessageInput>;

// Accepts a canonical lowercase UUID (the shape pg's `gen_random_uuid()` returns). A malformed
// conversationId must 400 in parseBody rather than reach the DB and surface as a 503.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseBody(body: MessageBody): ComicMessageInput | null {
  let conversationId: string | null = null;
  if (typeof body.conversationId === 'string' && body.conversationId.length > 0) {
    if (!UUID_REGEX.test(body.conversationId)) {
      return null;
    }
    conversationId = body.conversationId;
  }

  return {
    body: typeof body.body === 'string' ? body.body : '',
    channel: body.channel === 'feed' ? 'feed' : 'hub',
    conversationId,
    consentGranted: body.consentGranted === true,
  };
}

// Map a thrown repository error code to a known client response. Returns null for an unknown code,
// which the caller reports and turns into a 503 — so reportError only fires for genuinely unexpected
// failures, exactly as before.
function mapKnownMessageError(code: string): NextResponse | null {
  if (code === 'content_policy_violation') {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.moderationRejected, message: 'Message blocked by content moderation.' },
      { status: 422 },
    );
  }

  if (code === 'llm_consent_required') {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.consentRequired, message: 'AI processing consent is required before using the AI Assistant.' },
      { status: 403 },
    );
  }

  if (code === 'rate_limit_exceeded') {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.rateLimitExceeded, message: 'AI Assistant message rate limit exceeded.' },
      { status: 429 },
    );
  }

  return null;
}

type RoutedMessageResult = Awaited<ReturnType<typeof routeComicMessage>>;

// Turn a successful routing result into its response and audit entry.
function respondToRoutedMessage(result: RoutedMessageResult, userId: string): NextResponse {
  // No @comic mention → peer-to-peer message, the assistant does nothing.
  if (result.outcome === 'not_mentioned') {
    logComicAudit({
      actorId: userId,
      pluginId: 'comic',
      command: 'comic.message.route',
      status: 'allow',
      reason: 'not_mentioned_noop',
      targetType: 'comic_message',
      targetId: 'none',
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, routedToAssistant: false }, { status: 200 });
  }

  logComicAudit({
    actorId: userId,
    pluginId: 'comic',
    command: 'comic.message.route',
    status: 'allow',
    reason: result.outcome === 'human_first' ? 'safety_human_first' : 'interim_review_pending',
    targetType: 'comic_turn',
    targetId: result.userTurnId,
    result: 'success',
    errorCategory: null,
    metadata: {
      conversationId: result.conversationId,
      outcome: result.outcome,
      reviewId: result.reviewId,
      safetyCategory: result.safetyCategory,
    },
  });

  // The unreviewed draft is NEVER returned to the asker; only the safe holding response is.
  return NextResponse.json(
    {
      ok: true,
      routedToAssistant: true,
      status: result.outcome,
      conversationId: result.conversationId,
      holdingResponse: result.holdingResponse,
    },
    { status: 202 },
  );
}

export async function POST(request: Request) {
  const gate = await requireComicReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: MessageBody;
  try {
    body = (await request.json()) as MessageBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = parseBody(body);
  if (!input || !validateComicMessageInput(input)) {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Invalid message payload.' },
      { status: 400 },
    );
  }

  try {
    const result = await routeComicMessage(gate.auth.userId, gate.auth.username ?? null, input);
    return respondToRoutedMessage(result, gate.auth.userId);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown_error';

    const known = mapKnownMessageError(code);
    if (known) {
      return known;
    }

    reportError(error, { area: 'comic', op: 'message' });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: 'Unable to route message to the AI Assistant.' },
      { status: 503 },
    );
  }
}
