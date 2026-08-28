import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicAdminAccess } from '../../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { recordComicAdminAudit } from 'lib/comic/audit';
import { regenerateComicDraft } from 'lib/comic/repository';
import { reportError } from 'lib/observability/report';

// Admin-only: re-run the AI draft for a still-pending review item. Use after the drafting engine
// (the RunPod/Ollama endpoint) was down at ask time and has since recovered. Synchronous: the
// response says whether a draft was attached, or that the engine is still unreachable.
// The dynamic segment is the review-queue id (named `turnId` for route-shape parity with resolve).
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

  try {
    const result = await regenerateComicDraft(gate.auth.userId, reviewId);

    await recordComicAdminAudit({
      actorId: gate.auth.userId,
      pluginId: 'comic',
      command: 'comic.review.regenerate',
      status: 'allow',
      reason: result.attached ? 'draft_attached' : 'engine_unavailable',
      targetType: 'comic_review_queue',
      targetId: reviewId,
      result: 'success',
      errorCategory: null,
      metadata: { attached: result.attached, failureReason: result.reason },
    });

    return NextResponse.json({ ok: true, attached: result.attached, reason: result.reason }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'review_turnid_regenerate' });
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

    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: 'Unable to regenerate the draft.' },
      { status: 503 },
    );
  }
}
