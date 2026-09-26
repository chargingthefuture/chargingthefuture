import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicAdminAccess } from '../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { recordComicAdminAudit } from 'lib/comic/audit';
import { setUnlockHelpSentWithoutReview } from 'lib/comic/runtime-config';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

const COMMAND = 'comic.admin.unlock-help.set-review';

// Admin: switch whether @comic answers to Unlock questions from members not yet approved are sent
// without review (command comic.admin.unlock-help.set-review). Called from the Unlock help log page.
// Off puts those answers back in the review queue; every other @comic answer is held either way.
export async function POST(request: Request) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const gate = await requireComicAdminAccess();
  if (!gate.allowed) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  if (typeof body.withoutReview !== 'boolean') {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'withoutReview must be true or false.' },
      { status: 400 },
    );
  }
  const withoutReview = body.withoutReview;
  const audit = {
    actorId: gate.auth.userId,
    pluginId: 'comic' as const,
    command: COMMAND,
    status: 'allow' as const,
    reason: 'admin_route_guard',
    targetType: 'comic_runtime_config',
    targetId: 'unlock_help_without_review',
    metadata: { withoutReview },
  };

  try {
    const setting = await setUnlockHelpSentWithoutReview(gate.auth.userId, withoutReview);
    await recordComicAdminAudit({ ...audit, result: 'success', errorCategory: null });
    return NextResponse.json({ ok: true, setting }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'admin_unlock_help_set_review' });
    await recordComicAdminAudit({ ...audit, result: 'failure', errorCategory: 'persistence_error' });
    return NextResponse.json(
      {
        ok: false,
        code: COMIC_ERROR_CODE.persistenceUnavailable,
        message: 'Could not save the Unlock help setting.',
        reason: failureReason(error),
      },
      { status: 503 },
    );
  }
}
