import { NextResponse } from 'next/server';
import { requireReporterAccess, ensureMutationCsrf } from './_lib';
import { createBugReport, countRecentReportsByUser } from 'lib/bug-reports/repository';
import {
  BUG_REPORT_ERROR_CODE,
  BUG_REPORT_MESSAGE_MAX_LENGTH,
  BUG_REPORT_CONTEXT_MAX_LENGTH,
  BUG_REPORT_METADATA_MAX_LENGTH,
  BUG_REPORT_RATE_LIMIT_COUNT,
} from 'lib/bug-reports/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type BugReportSubmitInput = {
  message?: unknown;
  context?: unknown;
  pageUrl?: unknown;
  pluginSlug?: unknown;
  appVersion?: unknown;
};

function asTrimmedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, maxLength);
}

export async function POST(request: Request) {
  const gate = await requireReporterAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let input: BugReportSubmitInput;
  try {
    input = await request.json();
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: BUG_REPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const message = asTrimmedString(input.message, BUG_REPORT_MESSAGE_MAX_LENGTH);
  if (!message) {
    return NextResponse.json(
      {
        ok: false,
        code: BUG_REPORT_ERROR_CODE.invalidPayload,
        message: 'Please describe what went wrong.',
      },
      { status: 400 },
    );
  }

  const context = asTrimmedString(input.context, BUG_REPORT_CONTEXT_MAX_LENGTH);
  const pageUrl = asTrimmedString(input.pageUrl, BUG_REPORT_METADATA_MAX_LENGTH);
  const pluginSlug = asTrimmedString(input.pluginSlug, BUG_REPORT_METADATA_MAX_LENGTH);
  const appVersion = asTrimmedString(input.appVersion, BUG_REPORT_METADATA_MAX_LENGTH);
  const userAgent = asTrimmedString(
    request.headers.get('user-agent'),
    BUG_REPORT_METADATA_MAX_LENGTH,
  );

  try {
    const recentCount = await countRecentReportsByUser(gate.auth.userId);
    if (recentCount >= BUG_REPORT_RATE_LIMIT_COUNT) {
      return NextResponse.json(
        {
          ok: false,
          code: BUG_REPORT_ERROR_CODE.rateLimited,
          message: 'Thanks — we already have your recent reports. Please try again a little later.',
        },
        { status: 429 },
      );
    }

    const created = await createBugReport({
      userId: gate.auth.userId,
      message,
      context,
      pageUrl,
      pluginSlug,
      appVersion,
      userAgent,
    });

    return NextResponse.json(
      { ok: true, reportId: created.id, status: created.status },
      { status: 201 },
    );
  } catch (error) {
    reportError(error, { area: 'bug-reports', op: 'submit' });
    return NextResponse.json(
      {
        ok: false,
        code: BUG_REPORT_ERROR_CODE.persistenceUnavailable,
        message: 'We could not save your report. Please try again.',
      },
      { status: 503 },
    );
  }
}
