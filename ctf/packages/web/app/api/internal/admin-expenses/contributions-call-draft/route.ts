import { NextResponse } from 'next/server';
import { countApprovedMembers, listExpenses } from 'lib/admin-expenses/repository';
import { loadGpuBillState } from 'lib/admin-expenses/gpu-bill';
import { measuredGpuMonthlyCents } from 'lib/admin-expenses/gpu-bill-shared';
import { summarizeExpenses } from 'lib/admin-expenses/summary';
import { buildContributionsCallDraft, CONTRIBUTIONS_CALL_LINKED_PLUGINS } from 'lib/admin-expenses/contributions-call';
import { countTotalMembers } from 'lib/engagement/login-activity';
import { createAnnouncementDraft } from 'lib/feed/repository';
import { logFeedAudit } from 'lib/feed/audit';
import { getAppUrl } from 'lib/auth/runtime-env';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

// Cron-only: writes the twice-yearly "Contribute if you can" Commons post as an unpublished draft,
// with the current sign-up count, approved-member count and hosting cost filled in
// (.github/workflows/contributions-call-draft.yml). The owner checks the figures and publishes it
// from /admin/feed-announcements; nothing here publishes. Guarded by CRON_SECRET (Bearer).
const CI_ACTOR_ID = 'ci-contributions-call';

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    return false;
  }
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

// A missing RunPod reading is not a failure: the RunPod line falls back to its typed figure, as on
// /admin/expenses.
async function readGpuMeasuredCents(): Promise<number | null> {
  try {
    return measuredGpuMonthlyCents(await loadGpuBillState());
  } catch (error) {
    reportError(error, { area: 'admin-expenses', op: 'contributions_call_gpu_bill' });
    return null;
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, code: 'contributions_call_forbidden', message: 'Invalid cron secret.' }, { status: 403 });
  }

  try {
    const [expenses, approvedMembers, signedUp, gpuMeasuredCents] = await Promise.all([
      listExpenses(),
      countApprovedMembers(),
      countTotalMembers(),
      readGpuMeasuredCents(),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const summary = summarizeExpenses(expenses, approvedMembers, today, gpuMeasuredCents);
    const draft = buildContributionsCallDraft({ signedUp: signedUp ?? 0, summary, appUrl: getAppUrl() ?? null });
    if (!draft.ok) {
      return NextResponse.json({ ok: false, code: 'contributions_call_no_figures', message: `The draft was not written: ${draft.reason}` }, { status: 409 });
    }

    const announcement = await createAnnouncementDraft(CI_ACTOR_ID, {
      title: draft.title,
      body: draft.body,
      linkedPluginSlugs: CONTRIBUTIONS_CALL_LINKED_PLUGINS,
    });
    logFeedAudit({
      actorId: CI_ACTOR_ID,
      pluginId: 'feed',
      command: 'feed.announcement.draft.create',
      status: 'allow',
      reason: 'ci_contributions_call',
      targetType: 'announcement',
      targetId: announcement.id,
      result: 'success',
      errorCategory: null,
    });

    // Only the draft id and how many cost lines have no amount; the figures stay on the admin screen.
    return NextResponse.json({ ok: true, id: announcement.id, status: 'draft', unpricedLines: draft.unpricedProviders.length }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'admin-expenses', op: 'contributions_call_draft' });
    return NextResponse.json({ ok: false, code: 'contributions_call_unavailable', message: `The draft could not be written: ${failureReason(error)}` }, { status: 503 });
  }
}
