import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicAdminAccess } from '../../../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { logComicAudit } from 'lib/comic/audit';
import { acceptContribution, declineContribution } from 'lib/comic/contribution-repository';
import { grantContributionRecognition } from 'lib/comic/contribution-grant';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// The SAME content_hash formula importComicKnowledge.mjs uses. Keep the two in step: it is what makes
// a promoted entry and an imported one collapse onto the same row instead of duplicating, so two
// members quoting the same widely-shared passage do not double it in the library.
//
// The fields are joined with NUL, matching the canonical `contentHashOf` in
// ctf/scripts/lib/comicDatasetShared.mjs. That file is outside this package and cannot be imported
// here, so this is a deliberate second copy: change one and change the other in the same commit.
// Until 2026-07-29 this copy joined with a SPACE while the importer used NUL, which silently
// defeated the dedupe the comment above promises — a contributed post whose text was already in the
// library hashed differently, hit no conflict, and was stored a second time.
const HASH_SEPARATOR = String.fromCharCode(0);

function hashOf(entryType: string, question: string | null, content: string): string {
  return createHash('sha256')
    .update([entryType, question ?? '', content.trim()].join(HASH_SEPARATOR))
    .digest('hex');
}

// DECLINE: flip the contribution to declined with a reason the contributor will see.
async function handleDecline(id: string, reviewerId: string, rawReason: unknown): Promise<NextResponse> {
  const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
  if (reason.length === 0) {
    // A decline the contributor cannot understand reads as a judgment on what they lived
    // through. The reason is shown to them on their own page, so it is required.
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Give a reason — the contributor sees it.' },
      { status: 400 },
    );
  }

  const declined = await declineContribution({ contributionId: id, reviewerId, reason });
  if (!declined) {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.notFound, message: 'That contribution is not waiting for review.' },
      { status: 404 },
    );
  }

  logComicAudit({
    actorId: reviewerId,
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

// ACCEPT: promote the chosen entries, then make the recognition grant (which may fail without
// undoing the promotion — see the POST doc comment below).
async function handleAccept(id: string, reviewerId: string, rawExcluded: unknown): Promise<NextResponse> {
  const excludedEntryIds = Array.isArray(rawExcluded)
    ? rawExcluded.filter((value): value is string => typeof value === 'string')
    : [];

  const accepted = await acceptContribution({
    contributionId: id,
    reviewerId,
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
    reviewerId,
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
    actorId: reviewerId,
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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: `Could not read the request: ${failureReason(error)}` },
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
      return await handleDecline(id, gate.auth.userId, body.reason);
    }

    return await handleAccept(id, gate.auth.userId, body.excludedEntryIds);
  } catch (error) {
    reportError(error, { area: 'comic', op: 'contribution_review', extra: { contributionId: id } });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: `Could not record that review: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
