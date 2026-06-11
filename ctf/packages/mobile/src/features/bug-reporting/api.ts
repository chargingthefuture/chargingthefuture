// Report-a-problem API client — binds to the same live backend the web surface uses.
// POST /api/bug-reports → { ok: true, reportId, status } on 201.
//
// The mutation sends the same-origin CSRF header (`x-ctf-csrf: 1`) and JSON content
// type the route requires (see web app/api/bug-reports/_lib.ts → ensureMutationCsrf).
// The status code maps to one of the screen's result states: 201 success, 429
// rate-limited, anything else a generic error that preserves the typed text.

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://api.chargingthefuture.com';

// Bound every request so a stalled connection can't trap the screen in a submitting
// state forever. A timeout is treated like any other failure: the text is kept.
const REQUEST_TIMEOUT_MS = 15000;

// Mirrors the server's lifecycle statuses. A fresh report is `new`; a sanitizer-flagged
// one is `held_for_review` and waits for a human.
export type BugReportStatus =
  | 'new'
  | 'held_for_review'
  | 'issue_created'
  | 'rejected'
  | 'resolved';

export type BugReportSubmitResult =
  | { kind: 'success'; status: BugReportStatus }
  | { kind: 'rate_limited' }
  | { kind: 'error' };

export type BugReportSubmitInput = {
  message: string;
  context: string;
  pluginSlug?: string;
};

const KNOWN_STATUSES: readonly BugReportStatus[] = [
  'new',
  'held_for_review',
  'issue_created',
  'rejected',
  'resolved',
];

function readStatus(body: unknown): BugReportStatus {
  if (body && typeof body === 'object' && 'status' in body) {
    const candidate = (body as { status?: unknown }).status;
    if (typeof candidate === 'string' && KNOWN_STATUSES.includes(candidate as BugReportStatus)) {
      return candidate as BugReportStatus;
    }
  }
  return 'new';
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function submitBugReport(
  input: BugReportSubmitInput,
): Promise<BugReportSubmitResult> {
  const payload: Record<string, string> = { message: input.message };
  const context = input.context.trim();
  if (context.length > 0) {
    payload.context = context;
  }
  if (input.pluginSlug) {
    payload.pluginSlug = input.pluginSlug;
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE}/api/bug-reports`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-ctf-csrf': '1',
      },
      body: JSON.stringify(payload),
    });
  } catch {
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

  return { kind: 'error' };
}
