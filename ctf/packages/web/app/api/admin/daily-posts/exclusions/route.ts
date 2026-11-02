import { NextResponse } from 'next/server';
import { dailyPostsError, ensureDailyPostsMutationCsrf, parseExclusionInput, readJson, requireDailyPostsAdminAccess } from '../_lib';
import { recordDailyPostsAudit, setExclusion } from 'lib/daily-posts/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Leave a post out of the rotation, its theme groups and Today's stories, or bring it back. Body:
// { slug, excluded }. The post stays on the blog either way.
export async function POST(request: Request) {
  const csrf = ensureDailyPostsMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireDailyPostsAdminAccess();
  if (!gate.allowed) return gate.response;

  const read = await readJson(request);
  if (!read.ok) return dailyPostsError(`The change could not be read as JSON: ${read.reason}`, 'admin_daily_posts_invalid_payload', 400);
  const parsed = parseExclusionInput(read.body);
  if (!parsed.ok) return dailyPostsError(parsed.message, 'admin_daily_posts_invalid_payload', 400);

  try {
    const changed = await setExclusion(parsed.slug, parsed.excluded);
    if (changed) {
      await recordDailyPostsAudit({
        actorId: gate.auth.userId,
        command: 'admin.daily_posts.exclusion.set',
        targetType: 'exclusion',
        targetId: parsed.slug,
        metadata: { excluded: parsed.excluded },
      });
    }
    return NextResponse.json({ ok: true, slug: parsed.slug, excluded: parsed.excluded });
  } catch (error) {
    reportError(error, { area: 'admin-daily-posts', op: 'exclusion' });
    return dailyPostsError(`The change could not be saved: ${failureReason(error)}`, 'admin_daily_posts_unavailable', 503);
  }
}
