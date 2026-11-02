import { NextResponse } from 'next/server';
import { dailyPostsError, ensureDailyPostsMutationCsrf, isTemplateId, parseTemplateInput, readJson, requireDailyPostsAdminAccess } from '../../_lib';
import { deleteTemplate, getTemplate, recordDailyPostsAudit, updateTemplate } from 'lib/daily-posts/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteContext = { params: Promise<{ id: string }> };

// Edit a template's title or text. Body: { title, body }.
export async function PATCH(request: Request, context: RouteContext) {
  const csrf = ensureDailyPostsMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireDailyPostsAdminAccess();
  if (!gate.allowed) return gate.response;

  const { id } = await context.params;
  if (!isTemplateId(id)) return dailyPostsError('That template could not be found.', 'admin_daily_posts_not_found', 404);
  const read = await readJson(request);
  if (!read.ok) return dailyPostsError(`The template could not be read as JSON: ${read.reason}`, 'admin_daily_posts_invalid_payload', 400);
  const parsed = parseTemplateInput(read.body);
  if (!parsed.ok) return dailyPostsError(parsed.message, 'admin_daily_posts_invalid_payload', 400);

  try {
    const before = await getTemplate(id);
    if (!before) return dailyPostsError('That template could not be found.', 'admin_daily_posts_not_found', 404);
    const template = await updateTemplate(id, parsed.title, parsed.text);
    if (!template) return dailyPostsError('That template was removed while it was being edited.', 'admin_daily_posts_not_found', 404);
    await recordDailyPostsAudit({
      actorId: gate.auth.userId,
      command: 'admin.daily_posts.template.update',
      targetType: 'template',
      targetId: id,
      metadata: { before: { title: before.title, body: before.body }, after: { title: template.title, body: template.body } },
    });
    return NextResponse.json({ ok: true, template });
  } catch (error) {
    reportError(error, { area: 'admin-daily-posts', op: 'template_update' });
    return dailyPostsError(`The change could not be saved: ${failureReason(error)}`, 'admin_daily_posts_unavailable', 503);
  }
}

// Remove a template and its ticks.
export async function DELETE(request: Request, context: RouteContext) {
  const csrf = ensureDailyPostsMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireDailyPostsAdminAccess();
  if (!gate.allowed) return gate.response;

  const { id } = await context.params;
  if (!isTemplateId(id)) return dailyPostsError('That template could not be found.', 'admin_daily_posts_not_found', 404);

  try {
    const before = await getTemplate(id);
    if (!before) return dailyPostsError('That template could not be found.', 'admin_daily_posts_not_found', 404);
    await deleteTemplate(id);
    await recordDailyPostsAudit({
      actorId: gate.auth.userId,
      command: 'admin.daily_posts.template.delete',
      targetType: 'template',
      targetId: id,
      metadata: { before: { title: before.title, body: before.body }, after: null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    reportError(error, { area: 'admin-daily-posts', op: 'template_delete' });
    return dailyPostsError(`The template could not be removed: ${failureReason(error)}`, 'admin_daily_posts_unavailable', 503);
  }
}
