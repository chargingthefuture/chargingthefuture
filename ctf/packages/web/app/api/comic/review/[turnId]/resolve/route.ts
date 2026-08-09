import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicAdminAccess } from '../../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { logComicAudit } from 'lib/comic/audit';
import { resolveComicReview } from 'lib/comic/repository';
import type { ComicReviewResolveInput } from 'lib/comic/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type ResolveBody = Partial<ComicReviewResolveInput>;

const RESOLUTIONS = ['approve', 'correct', 'reject'] as const;

function isResolution(value: unknown): value is ComicReviewResolveInput['resolution'] {
  return typeof value === 'string' && (RESOLUTIONS as readonly string[]).includes(value);
}

// Keep only string entries from a possibly-untrusted array; non-arrays yield an empty list. The
// repository does the real validation (registry membership, dedupe, cap) — here we just narrow the
// shape so a malformed payload cannot reach it.
function parseLinkedPluginSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

// Repository error codes that all mean "the resolution payload was invalid" and map to a 400.
const INVALID_RESOLUTION_CODES = new Set([
  'invalid_resolution',
  'correction_required',
  'correction_too_long',
  'reason_too_long',
  'approve_requires_content',
]);

// Map a thrown repository error code to its response. Unknown codes fall through to the 503.
function mapResolveError(code: string): NextResponse {
  if (code === 'review_not_found') {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.reviewNotFound, message: 'Review item not found.' },
      { status: 404 },
    );
  }

  if (code === 'review_already_resolved') {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.reviewAlreadyResolved, message: 'Review item already resolved.' },
      { status: 409 },
    );
  }

  if (INVALID_RESOLUTION_CODES.has(code)) {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Invalid review resolution payload.' },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: 'Unable to resolve review item.' },
    { status: 503 },
  );
}

function parseBody(body: ResolveBody): ComicReviewResolveInput | null {
  // Reject (rather than silently coerce to 'approve') any resolution outside the allowed set so a
  // malformed/unknown value cannot accidentally publish a draft.
  if (!isResolution(body.resolution)) {
    return null;
  }

  return {
    resolution: body.resolution,
    correctedBody: typeof body.correctedBody === 'string' ? body.correctedBody : null,
    reason: typeof body.reason === 'string' ? body.reason : null,
    linkedPluginSlugs: parseLinkedPluginSlugs(body.linkedPluginSlugs),
  };
}

// The dynamic segment is the review-queue id (named `turnId` for route-shape parity with the
// inventory's `/review/[turnId]/resolve` path).
export async function POST(request: Request, { params }: { params: Promise<{ turnId: string }> }) {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { turnId: reviewId } = await params;

  let body: ResolveBody;
  try {
    body = (await request.json()) as ResolveBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const input = parseBody(body);
  if (!input) {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Invalid review resolution payload.' },
      { status: 400 },
    );
  }

  try {
    const result = await resolveComicReview(gate.auth.userId, reviewId, input);

    logComicAudit({
      actorId: gate.auth.userId,
      pluginId: 'comic',
      command: 'comic.review.resolve',
      status: 'allow',
      reason: `review_${result.status}`,
      targetType: 'comic_review_queue',
      targetId: result.reviewId,
      result: 'success',
      errorCategory: null,
      metadata: {
        turnId: result.turnId,
        status: result.status,
        trainingExampleId: result.trainingExampleId,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        reviewId: result.reviewId,
        status: result.status,
        trainingExampleId: result.trainingExampleId,
        decidedAt: result.decidedAtIso,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'comic', op: 'review_turnid_resolve' });
    const code = error instanceof Error ? error.message : 'unknown_error';
    return mapResolveError(code);
  }
}
