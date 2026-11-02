import { NextResponse } from 'next/server';
import { dailyPostsError, ensureDailyPostsMutationCsrf, parseTemplateInput, readJson, requireDailyPostsAdminAccess } from '../_lib';
import { createTemplate, recordDailyPostsAudit } from 'lib/daily-posts/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Save a post that is not on the blog, so it gets its own copy control for reuse. Body: { title, body }.
export async function POST(request: Request) {
  const csrf = ensureDailyPostsMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireDailyPostsAdminAccess();
  if (!gate.allowed) return gate.response;

  const read = await readJson(request);
  if (!read.ok) return dailyPostsError(`The template could not be read as JSON: ${read.reason}`, 'admin_daily_posts_invalid_payload', 400);
  const parsed = parseTemplateInput(read.body);
  if (!parsed.ok) return dailyPostsError(parsed.message, 'admin_daily_posts_invalid_payload', 400);

  try {
    const template = await createTemplate(parsed.title, parsed.text);
    await recordDailyPostsAudit({
      actorId: gate.auth.userId,
      command: 'admin.daily_posts.template.create',
      targetType: 'template',
      targetId: template.id,
      metadata: { after: { title: template.title, body: template.body } },
    });
    return NextResponse.json({ ok: true, template }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'admin-daily-posts', op: 'template_create' });
    return dailyPostsError(`The template could not be saved: ${failureReason(error)}`, 'admin_daily_posts_unavailable', 503);
  }
}
