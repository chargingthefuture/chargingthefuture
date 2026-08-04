import { reportError } from 'lib/observability/report';

// The client half of rule 137. A route that explains itself is worth nothing if the screen replaces
// the explanation with its own fallback sentence — that is where the reason used to disappear a second
// time, leaving a banner that says "Could not save." and nothing else.
//
// Two helpers, one per way a request fails:
//
//   responseFailureText  the request answered with an error. Show what the route said; fall back to the
//                        screen's own sentence only when the body carries nothing.
//   failureText          the request never answered (network down, a parse throw). There is no server
//                        text to show, so keep the screen's sentence — but report the caught value so
//                        it is not lost, and on an operator surface name the reason in the text.
//
// This module is import-safe from client components: it pulls in no server-only code. The server half
// lives in `lib/errors/failure.ts` (which imports next/server and must not be used from a component).

// Matches the cap the server helper uses, so a long upstream message reads the same in both places.
const MAX_REASON_LENGTH = 300;

function reasonOf(error: unknown): string {
  const raw = (error instanceof Error ? error.message : String(error)).trim();
  if (raw.length === 0) {
    return error instanceof Error ? `${error.name} with no message` : 'unknown error';
  }
  return raw.length > MAX_REASON_LENGTH ? `${raw.slice(0, MAX_REASON_LENGTH)}…` : raw;
}

// The readable reason behind a caught value, with nothing reported. For a local failure that is the
// person's own input rather than an incident — a JSON textarea that does not parse — where the reason
// belongs on screen but an error report would only be noise.
export function reasonText(error: unknown): string {
  return reasonOf(error);
}

type FailureBody = {
  message?: unknown;
  reason?: unknown;
  detail?: unknown;
  reference?: unknown;
};

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

// What the route said about this failure, or `fallback` when it said nothing. Reads the body
// defensively — a non-JSON error body (a proxy's HTML page) yields the fallback rather than a throw.
// When the body carries a `reference`, it is appended so a screenshot can be matched to the log line.
//
// `audience` only affects the empty-body case: an operator also gets the HTTP status, since a bare
// sentence with no status is the dead end this rule exists to remove. A member gets the plain sentence.
export async function responseFailureText(
  response: Response,
  fallback: string,
  audience: 'operator' | 'member' = 'operator',
): Promise<string> {
  let body: FailureBody | null = null;
  try {
    body = (await response.json()) as FailureBody;
  } catch {
    body = null;
  }
  const said = firstString(body?.message, body?.reason, body?.detail);
  const plain = fallback.trim().replace(/\s+$/, '');
  const text = said ?? (audience === 'member' ? plain : `${plain} (HTTP ${response.status})`);
  const reference = firstString(body?.reference);
  return reference ? `${text} [ref ${reference}]` : text;
}

type FailureTextOptions = {
  // Coarse grouping and the specific operation, same meaning as `reportError`.
  area: string;
  op: string;
  // The screen's own sentence, used when there is no server text to show.
  fallback: string;
  // `operator` (default) names the reason in the returned text; `member` keeps the plain sentence and
  // sends the reason to the error report only.
  audience?: 'operator' | 'member';
  // Extra debugging context for the report. Never secrets.
  extra?: Record<string, unknown>;
};

// Report a caught value and return the text to show. Use this in a `catch` around a request: the
// caught value reaches the logs either way, and an operator sees the reason instead of guessing.
export function failureText(error: unknown, options: FailureTextOptions): string {
  reportError(error, { area: options.area, op: options.op, extra: options.extra });
  if (options.audience === 'member') {
    return options.fallback;
  }
  return `${options.fallback.trim().replace(/\s+$/, '')} (${reasonOf(error)})`;
}
