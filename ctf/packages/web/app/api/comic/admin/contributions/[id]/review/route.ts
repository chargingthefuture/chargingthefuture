import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicAdminAccess } from '../../../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { logComicAudit } from 'lib/comic/audit';
import { acceptContribution, declineContribution } from 'lib/comic/contribution-repository';
import { grantContributionRecognition } from 'lib/comic/contribution-grant';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// The SAME content_hash formula importComicKnowledge.mjs uses. Keep the two in step: it is what makes
// a promoted entry and an imported one collapse onto the same row instead of duplicating, so two
// members quoting the same widely-shared passage do not double it in the library.
function hashOf(entryType: string, question: string | null, content: string): string {
  return createHash('sha256')
    .update(`${entryType} ${question ?? ''} ${content.trim()}`)
    .digest('hex');
}

// Admin: accept or decline a contribution.
//
// ACCEPT promotes the chosen entries into comic_knowledge_entries — the moment a member's writing
// becomes something the assistant can quote — then makes the ServiceCredits recognition grant.
// Promotion and the status flip share one transaction, so a half-accepted contribution cannot exist.
//
// The grant is deliberately AFTER promotion and is allowed to fail without undoing it: credits are
// recognition, and a mint outage must not cost the library the writing or make the reviewer redo the
// reading. A failed grant is reported back so it can be retried by hand.
//
// Only an unlocked member receives credits (see lib/comic/contribution-grant.ts). Anyone signed in
// may contribute.
export async function POST(request: Request, context: RouteContext) {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) return gate.response;

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const { id } = await context.params;

  let body: { action?: string; excludedEntryIds?: unknown; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Could not read the request.' },
      { status: 400 },
    );
  }

  if (body.action !== 'accept' && body.action !== 'decline') {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Action must be accept or decline.' },
      { status: 400 },
    );
  }

  try {
    if (body.action === 'decline') {
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (reason.length === 0) {
        // A decline the contributor cannot understand reads as a judgement on what they lived
        // through. The reason is shown to them on their own page, so it is required.
        return NextResponse.json(
          { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Give a reason — the contributor sees it.' },
          { status: 400 },
        );
      }

      const declined = await declineContribution({ contributionId: id, reviewerId: gate.auth.userId, reason });
      if (!declined) {
        return NextResponse.json(
          { ok: false, code: COMIC_ERROR_CODE.notFound, message: 'That contribution is not waiting for review.' },
          { status: 404 },
        );
      }

      logComicAudit({
        actorId: gate.auth.userId,
        pluginId: 'comic',
        command: 'comic.contribution.review',
        status: 'allow',
        reason: 'declined',
        targetType: 'contribution',
        targetId: id,
        result: 'success',
        errorCategory: null,
      });
      return NextResponse.json({ ok: true, status: 'declined' }, { status: 200 });
    }

    const excludedEntryIds = Array.isArray(body.excludedEntryIds)
      ? body.excludedEntryIds.filter((value): value is string => typeof value === 'string')
      : [];

    const accepted = await acceptContribution({
      contributionId: id,
      reviewerId: gate.auth.userId,
      excludedEntryIds,
      hashOf,
    });
    if (!accepted) {
      return NextResponse.json(
        { ok: false, code: COMIC_ERROR_CODE.notFound, message: 'That contribution is not waiting for review.' },
        { status: 404 },
      );
    }

    const grant = await grantContributionRecognition({
      contributionId: id,
      contributorUserId: accepted.contributorUserId,
      reviewerId: gate.auth.userId,
    });
    if (grant.status === 'failed') {
      // Reported, never thrown: the writing is already in the library and the reading is done.
      reportError(new Error(`contribution grant failed: ${grant.reason}`), {
        area: 'comic',
        op: 'contribution_grant',
        extra: { contributionId: id },
      });
    }

    logComicAudit({
      actorId: gate.auth.userId,
      pluginId: 'comic',
      command: 'comic.contribution.review',
      status: 'allow',
      reason: 'accepted',
      targetType: 'contribution',
      targetId: id,
      result: 'success',
      errorCategory: null,
      metadata: {
        promoted: accepted.promoted,
        alreadyPresent: accepted.alreadyPresent,
        excluded: excludedEntryIds.length,
        grant: grant.status,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        status: 'accepted',
        promoted: accepted.promoted,
        alreadyPresent: accepted.alreadyPresent,
        grant,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'comic', op: 'contribution_review', extra: { contributionId: id } });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: 'Could not record that review.' },
      { status: 503 },
    );
  }
}
