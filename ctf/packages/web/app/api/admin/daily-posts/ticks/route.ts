import { NextResponse } from 'next/server';
import { dailyPostsError, ensureDailyPostsMutationCsrf, parseTickInput, readJson, requireDailyPostsAdminAccess } from '../_lib';
import { recordDailyPostsAudit, setTick } from 'lib/daily-posts/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Mark something as pasted on a day, or take the mark back. Body: { itemKey, date, done }.
export async function POST(request: Request) {
  const csrf = ensureDailyPostsMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireDailyPostsAdminAccess();
  if (!gate.allowed) return gate.response;

  const read = await readJson(request);
  if (!read.ok) return dailyPostsError(`The tick could not be read as JSON: ${read.reason}`, 'admin_daily_posts_invalid_payload', 400);
  const parsed = parseTickInput(read.body);
  if (!parsed.ok) return dailyPostsError(parsed.message, 'admin_daily_posts_invalid_payload', 400);
  const { itemKey, date, done } = parsed;

  try {
    const changed = await setTick(itemKey, date, done);
    if (changed) {
      await recordDailyPostsAudit({
        actorId: gate.auth.userId,
        command: 'admin.daily_posts.tick.set',
        targetType: 'tick',
        targetId: itemKey,
        metadata: { date, done },
      });
    }
    return NextResponse.json({ ok: true, itemKey, date, done });
  } catch (error) {
    reportError(error, { area: 'admin-daily-posts', op: 'tick' });
    return dailyPostsError(`The tick could not be saved: ${failureReason(error)}`, 'admin_daily_posts_unavailable', 503);
  }
}
