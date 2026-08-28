import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireComicAdminAccess } from '../../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { setKnowledgeEntryActive } from 'lib/comic/knowledge-admin';
import { recordComicAdminAudit } from 'lib/comic/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

type RouteProps = { params: Promise<{ entryId: string }> };

// Admin: switch one grounding entry on or off for retrieval — the write half of knowledge curation
// (command comic.admin.knowledge.set-active). Deactivating never deletes: the row stays for history
// and can be switched back on; retrieval simply skips inactive rows.
export async function PUT(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const gate = await requireComicAdminAccess();
  if (!gate.allowed) return gate.response;

  const { entryId } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  if (typeof body.active !== 'boolean') {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'active must be true or false.' },
      { status: 400 },
    );
  }

  try {
    const entry = await setKnowledgeEntryActive(entryId, body.active);
    if (!entry) {
      // Recorded too: an admin reaching for an entry that is not there is worth seeing in the trail,
      // and the point of the trail is that what did not happen is as legible as what did.
      await recordComicAdminAudit({
        actorId: gate.auth.userId,
        pluginId: 'comic',
        command: 'comic.admin.knowledge.set-active',
        status: 'deny',
        reason: 'not_found',
        targetType: 'knowledge_entry',
        targetId: entryId,
        result: 'failure',
        errorCategory: 'not_found',
        metadata: { active: body.active },
      });
      return NextResponse.json(
        { ok: false, code: COMIC_ERROR_CODE.notFound, message: 'Knowledge entry not found.' },
        { status: 404 },
      );
    }
    await recordComicAdminAudit({
      actorId: gate.auth.userId,
      pluginId: 'comic',
      command: 'comic.admin.knowledge.set-active',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'knowledge_entry',
      targetId: entryId,
      result: 'success',
      errorCategory: null,
      metadata: { active: body.active },
    });
    return NextResponse.json({ ok: true, entry }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'admin_knowledge_set_active' });
    await recordComicAdminAudit({
      actorId: gate.auth.userId,
      pluginId: 'comic',
      command: 'comic.admin.knowledge.set-active',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'knowledge_entry',
      targetId: entryId,
      result: 'failure',
      errorCategory: 'persistence_error',
      metadata: { active: body.active },
    });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: `Could not update the knowledge entry: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
