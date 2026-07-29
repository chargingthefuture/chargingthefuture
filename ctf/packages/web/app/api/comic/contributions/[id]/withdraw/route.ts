import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicContributionAccess } from '../../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { logComicAudit } from 'lib/comic/audit';
import { withdrawContribution } from 'lib/comic/contribution-repository';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// Withdraw a contribution. This route is the whole reason the consent form can promise withdrawal
// and mean it: the member presses a button and their material stops being quoted, without having to
// ask anyone or wait for a person to act.
//
// It works because the assistant reads from a table at answer time rather than from model weights.
// The repository deactivates every knowledge row this contribution produced in the same transaction
// that marks it withdrawn, so there is no window where the submission reads as withdrawn while the
// assistant is still quoting it.
export async function POST(request: Request, context: RouteContext) {
  const gate = await requireComicContributionAccess();
  if (!gate.allowed) return gate.response;

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const { id } = await context.params;

  try {
    // Scoped to the caller inside the query — a member can only withdraw their own contribution, and
    // an id belonging to someone else is indistinguishable from one that does not exist.
    const withdrawn = await withdrawContribution(gate.auth.userId, id);
    if (!withdrawn) {
      return NextResponse.json(
        {
          ok: false,
          code: COMIC_ERROR_CODE.notFound,
          message: 'That contribution was not found, or it has already been withdrawn.',
        },
        { status: 404 },
      );
    }

    logComicAudit({
      actorId: gate.auth.userId,
      pluginId: 'comic',
      command: 'comic.contribution.withdraw',
      status: 'allow',
      reason: 'ok',
      targetType: 'contribution',
      targetId: id,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'contribution_withdraw', extra: { contributionId: id } });
    return NextResponse.json(
      {
        ok: false,
        code: COMIC_ERROR_CODE.persistenceUnavailable,
        message: 'Could not withdraw that contribution. Nothing was changed — try again.',
      },
      { status: 503 },
    );
  }
}
