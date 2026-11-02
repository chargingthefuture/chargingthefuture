import { NextResponse } from 'next/server';
import { dailyPostsError, ensureDailyPostsMutationCsrf, readJson, requireDailyPostsAdminAccess } from '../_lib';
import { recordDailyPostsAudit, setThemeChoice } from 'lib/daily-posts/repository';
import { isDailyPostThemeId, type DailyPostThemeId } from 'lib/daily-posts/themes';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Set the theme groups a post appears in. Body: { slug, themes } where themes is a list of theme
// ids, or null to go back to the groups the post's own links put it in.
export async function POST(request: Request) {
  const csrf = ensureDailyPostsMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireDailyPostsAdminAccess();
  if (!gate.allowed) return gate.response;

  const read = await readJson(request);
  if (!read.ok) return dailyPostsError(`The choice could not be read as JSON: ${read.reason}`, 'admin_daily_posts_invalid_payload', 400);
  const { slug, themes } = read.body;
  if (typeof slug !== 'string' || !slug || slug.length > 300) {
    return dailyPostsError('slug must be the post\'s slug.', 'admin_daily_posts_invalid_payload', 400);
  }
  let chosen: DailyPostThemeId[] | null = null;
  if (themes !== null) {
    if (!Array.isArray(themes) || !themes.every(isDailyPostThemeId)) {
      return dailyPostsError('themes must be a list of theme ids, or null.', 'admin_daily_posts_invalid_payload', 400);
    }
    chosen = [...new Set(themes)];
  }

  try {
    await setThemeChoice(slug, chosen);
    await recordDailyPostsAudit({
      actorId: gate.auth.userId,
      command: 'admin.daily_posts.theme_choice.set',
      targetType: 'theme_choice',
      targetId: slug,
      metadata: { themes: chosen },
    });
    return NextResponse.json({ ok: true, slug, themes: chosen });
  } catch (error) {
    reportError(error, { area: 'admin-daily-posts', op: 'theme_choice' });
    return dailyPostsError(`The choice could not be saved: ${failureReason(error)}`, 'admin_daily_posts_unavailable', 503);
  }
}
