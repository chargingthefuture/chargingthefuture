// Client-side submit logic for the Report-a-problem modal. Posts to the real
// /api/bug-reports route with the same-origin CSRF confirmation header and maps
// the HTTP status to one of the modal's result states. Kept separate from the
// React components so the mapping is unit-readable and reusable (rule 116).

import { BUG_REPORT_STATUS, type BugReportStatus } from '@/lib/bug-reports/constants';

// Every mutating request to a CTF route carries this header; the server rejects a
// POST without it (see app/api/bug-reports/_lib.ts → ensureMutationCsrf).
export const BUG_REPORT_CSRF_HEADERS = {
  'Content-Type': 'application/json',
  'x-ctf-csrf': '1',
} as const;

export const BUG_REPORT_ENDPOINT = '/api/bug-reports';

export type BugReportSubmitResult =
  | { kind: 'success'; status: BugReportStatus }
  | { kind: 'rate_limited' }
  | { kind: 'error' };

export type BugReportSubmitInput = {
  message: string;
  context: string;
  // Page the member was on when they opened the report. The server caps it at 512
  // characters; we send the whole href and let the server trim.
  pageUrl?: string;
  // Plugin the member was using, if the surface could work it out. Optional.
  pluginSlug?: string;
};

function isBugReportStatus(value: unknown): value is BugReportStatus {
  return (
    typeof value === 'string' && (BUG_REPORT_STATUS as readonly string[]).includes(value)
  );
}

// Narrow the unknown JSON body to read `status` without using `any`.
function readStatus(body: unknown): BugReportStatus {
  if (body && typeof body === 'object' && 'status' in body) {
    const candidate = (body as { status?: unknown }).status;
    if (isBugReportStatus(candidate)) {
      return candidate;
    }
  }
  return 'new';
}

export async function submitBugReport(
  input: BugReportSubmitInput,
): Promise<BugReportSubmitResult> {
  const payload: Record<string, string> = { message: input.message };
  const context = input.context.trim();
  if (context.length > 0) {
    payload.context = context;
  }
  if (input.pageUrl) {
    payload.pageUrl = input.pageUrl;
  }
  if (input.pluginSlug) {
    payload.pluginSlug = input.pluginSlug;
  }

  let response: Response;
  try {
    response = await fetch(BUG_REPORT_ENDPOINT, {
      method: 'POST',
      headers: BUG_REPORT_CSRF_HEADERS,
      body: JSON.stringify(payload),
    });
  } catch {
    // Network failure (offline, dropped request). Treated like any other failure:
    // the typed text is preserved and the member can try again.
    return { kind: 'error' };
  }

  if (response.status === 201) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { kind: 'success', status: readStatus(body) };
  }

  if (response.status === 429) {
    return { kind: 'rate_limited' };
  }

  // 400 / 401 / 403 / 503 and anything else fall through to the generic error
  // state, which keeps the member's text and offers a retry.
  return { kind: 'error' };
}

// Work out the plugin slug for the page the member is reporting from, if the path
// is /apps/<slug>. Returns undefined elsewhere so we never send a bogus slug.
export function derivePluginSlugFromPath(pathname: string): string | undefined {
  const match = /^\/apps\/([^/?#]+)/.exec(pathname);
  if (!match) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
