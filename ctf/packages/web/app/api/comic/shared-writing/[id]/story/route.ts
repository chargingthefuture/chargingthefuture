import { NextResponse } from 'next/server';
import { SE_MEMBER_STORY_CONSENT_VERSION, SE_MEMBER_STORY_WORDS } from '@ctf/shared';
import { ensureMutationCsrf, requireComicSharedWritingAccess } from '../../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { logComicAudit } from 'lib/comic/audit';
import { setSharedWritingStory } from 'lib/comic/shared-writing-stories';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Turn "Also show it as a story on Today" on or off for one of the member's own contributions. Open
// on the same terms as contributing (the Knowledge Library exception): choosing is allowed before
// Unlock, and the story still shows only once a person accepted the writing and the writer's Unlock
// is approved (lib/today/sources-member.ts).
export async function POST(request: Request, context: RouteContext) {
  const gate = await requireComicSharedWritingAccess();
  if (!gate.allowed) return gate.response;

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) return csrfDeny;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { show?: unknown } | null;
  if (!UUID.test(id) || typeof body?.show !== 'boolean') {
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.invalidPayload, message: 'Send which contribution and whether to show it, as true or false.' },
      { status: 400 },
    );
  }
  const show = body.show;

  try {
    const changed = await setSharedWritingStory(gate.auth.userId, id, show);
    if (!changed) {
      return NextResponse.json(
        { ok: false, code: COMIC_ERROR_CODE.notFound, message: 'That contribution was not found, or it was withdrawn or not used.' },
        { status: 404 },
      );
    }
    logComicAudit({
      actorId: gate.auth.userId,
      pluginId: 'comic',
      command: 'comic.contribution.story.set',
      status: 'allow',
      reason: 'ok',
      targetType: 'contribution',
      targetId: id,
      result: 'success',
      errorCategory: null,
      metadata: { show, storyConsentVersion: show ? SE_MEMBER_STORY_CONSENT_VERSION : null },
    });
    return NextResponse.json({ ok: true, showAsStory: show }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'contribution_story_set', extra: { contributionId: id } });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: SE_MEMBER_STORY_WORDS.failed },
      { status: 503 },
    );
  }
}
