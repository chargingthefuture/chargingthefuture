import { NextRequest, NextResponse } from 'next/server';
import { secretsMatch } from 'lib/auth/internal-secret';
import { recordDirectoryAdminAudit } from 'lib/directory/audit';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { normalizeInviteSlug, parseDirectoryInviteInput } from 'lib/directory/invite-input';
import { deleteDirectoryInviteBySlug, upsertDirectoryInvite } from 'lib/directory/invites';
import { failureResponse } from 'lib/errors/failure';

// Machine writes for the Directory invite wall (owner decision, 2026-10-15). The invites are written
// in a private repository, and its job calls this route to put each one into the app (POST) or take
// one out (DELETE). Bearer INTERNAL_SERVICE_SECRET, the same as the other internal routes: 503 when
// it is not set here, 401 when the caller's does not match. Every write leaves a durable audit row.

const CI_ACTOR_ID = 'ci-directory-invites';

function checkSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'Not configured', message: 'INTERNAL_SERVICE_SECRET is not set on this server.' },
      { status: 503 },
    );
  }
  if (!secretsMatch(request.headers.get('authorization'), `Bearer ${secret}`)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized', message: 'The Authorization header is not Bearer INTERNAL_SERVICE_SECRET.' },
      { status: 401 },
    );
  }
  return null;
}

function invalid(message: string, field?: string): NextResponse {
  return NextResponse.json({ ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, field, message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const denied = checkSecret(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch (caught) {
    return invalid(`The body is not valid JSON: ${caught instanceof Error ? caught.message : String(caught)}`);
  }

  const parsed = parseDirectoryInviteInput(body);
  if (!parsed.ok) {
    return invalid(parsed.message, parsed.field);
  }

  const invite = parsed.value;
  try {
    const result = await upsertDirectoryInvite(invite);
    if (result.status === 'handle_taken') {
      await recordDirectoryAdminAudit({
        actorId: CI_ACTOR_ID, command: 'directory.invite.upsert', status: 'deny', reason: 'quora_handle_taken',
        targetType: 'invite', targetId: invite.slug, result: 'failure', errorCategory: 'conflict',
        metadata: { heldBy: result.slug },
      });
      return NextResponse.json(
        {
          ok: false,
          code: DIRECTORY_ERROR_CODE.conflict,
          field: 'quoraHandle',
          message: `quoraHandle: ${invite.quoraHandle} already has an invite under slug ${result.slug}. Delete that one first, or send this under the same slug.`,
        },
        { status: 409 },
      );
    }
    if (result.status === 'code_taken') {
      await recordDirectoryAdminAudit({
        actorId: CI_ACTOR_ID, command: 'directory.invite.upsert', status: 'deny', reason: 'invite_code_taken',
        targetType: 'invite', targetId: invite.slug, result: 'failure', errorCategory: 'conflict',
        metadata: { heldBy: result.slug },
      });
      return NextResponse.json(
        {
          ok: false,
          code: DIRECTORY_ERROR_CODE.conflict,
          field: 'inviteCode',
          message: `inviteCode: this code is already used by the invite under slug ${result.slug}. Make a new random code for this invite.`,
        },
        { status: 409 },
      );
    }
    await recordDirectoryAdminAudit({
      actorId: CI_ACTOR_ID, command: 'directory.invite.upsert', status: 'allow', reason: `invite_${result.status}`,
      targetType: 'invite', targetId: invite.slug, result: 'success', errorCategory: null,
      metadata: { hasImage: invite.image !== null, publishedOn: invite.publishedOn, public: invite.isPublic },
    });
    return NextResponse.json({ ok: true, id: result.id, slug: invite.slug, status: result.status }, { status: result.status === 'created' ? 201 : 200 });
  } catch (error) {
    return failureResponse({
      summary: `Could not save the invite ${invite.slug}`,
      error,
      code: DIRECTORY_ERROR_CODE.persistenceUnavailable,
      area: 'directory',
      op: 'internal_invite_upsert',
    });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = checkSecret(request);
  if (denied) return denied;

  const slug = normalizeInviteSlug(request.nextUrl.searchParams.get('slug'));
  if (!slug) {
    return invalid('slug: required as a query parameter (?slug=…), lower-case letters, digits and hyphens.', 'slug');
  }

  try {
    const removed = await deleteDirectoryInviteBySlug(slug);
    await recordDirectoryAdminAudit({
      actorId: CI_ACTOR_ID, command: 'directory.invite.delete', status: 'allow', reason: removed ? 'invite_deleted' : 'invite_not_found',
      targetType: 'invite', targetId: slug, result: removed ? 'success' : 'failure', errorCategory: removed ? null : 'not_found',
    });
    if (!removed) {
      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: `No invite has the slug ${slug}.` },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, slug, status: 'deleted' }, { status: 200 });
  } catch (error) {
    return failureResponse({
      summary: `Could not delete the invite ${slug}`,
      error,
      code: DIRECTORY_ERROR_CODE.persistenceUnavailable,
      area: 'directory',
      op: 'internal_invite_delete',
    });
  }
}
