import { NextResponse } from 'next/server';
import { requireBugReportAdminAccess } from '../_lib';
import { BUG_REPORT_ERROR_CODE } from 'lib/bug-reports/constants';
import { listReportsForAdmin } from 'lib/bug-reports/repository';
import { reportError } from 'lib/observability/report';

// Admin list of bug reports for the /admin/bug-reports review page. Held reports first.
// Redacted text only — the raw user text never leaves the database (rule 129).
export async function GET() {
  const gate = await requireBugReportAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const rows = await listReportsForAdmin();
    const items = rows.map((row) => ({
      id: row.id,
      status: row.status,
      redactedMessage: row.redacted_message,
      redactedContext: row.redacted_context,
      riskFlags: row.risk_flags ?? [],
      riskLevel: row.risk_level,
      pageUrl: row.page_url,
      pluginSlug: row.plugin_slug,
      appVersion: row.app_version,
      triageRepo: row.triage_repo,
      issueNumber: row.issue_number,
      issueUrl: row.issue_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'bug-reports', op: 'admin-list' });
    return NextResponse.json(
      {
        ok: false,
        code: BUG_REPORT_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to load bug reports.',
      },
      { status: 503 },
    );
  }
}
