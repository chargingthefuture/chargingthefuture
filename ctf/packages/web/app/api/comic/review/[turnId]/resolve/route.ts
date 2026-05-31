import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicAdminAccess } from '../../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { logComicAudit } from 'lib/comic/audit';
import { resolveComicReview } from 'lib/comic/repository';
import type { ComicReviewResolveInput } from 'lib/comic/types';

type ResolveBody = Partial<ComicReviewResolveInput>;

function parseBody(body: ResolveBody): ComicReviewResolveInput {
  return {
    resolution: body.resolution === 'approve' || body.resolution === 'correct' || body.resolution === 'reject'
      ? body.resolution
      : 'approve',
    correctedBody: typeof body.correctedBody === 'string' ? body.correctedBody : null,
    reason: typeof body.reason === 'string' ? body.reason : null,
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
  } catch {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const input = parseBody(body);

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
    const code = error instanceof Error ? error.message : 'unknown_error';

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

    if (code === 'invalid_resolution' || code === 'correction_required' || code === 'correction_too_long' || code === 'reason_too_long') {
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
}
