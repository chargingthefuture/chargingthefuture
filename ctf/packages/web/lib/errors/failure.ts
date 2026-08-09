import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { reportError } from 'lib/observability/report';

// Verbose failure reporting for API routes (rule 137).
//
// A route that catches its own error and answers with a fixed sentence throws away the only thing that
// says what to fix. "Broadcast input unavailable." or "Something went wrong." costs a round of guessing
// every time it appears, and the person reading it is usually holding a phone with no access to the
// server logs. So: the reason always travels with the failure. On an operator-only surface (admin,
// internal, cron) it travels in the response text. On a member-facing surface the text stays plain and
// the reason goes to the error report, tagged with a short reference the member can quote in a bug
// report.
//
// Use `failureResponse` for both cases. Use `failureReason` on its own when a route already builds its
// own response shape and only needs the reason string.

// The echoed reason is capped so one runaway upstream message cannot fill a banner or a log line.
const MAX_REASON_LENGTH = 300;

// The readable reason behind a caught value: an Error's message, or the value itself when something
// non-Error was thrown. Never empty — an empty reason reads as "no information", which is the problem
// this module exists to remove.
export function failureReason(error: unknown, maxLength: number = MAX_REASON_LENGTH): string {
  const raw = (error instanceof Error ? error.message : String(error)).trim();
  if (raw.length === 0) {
    return error instanceof Error ? `${error.name} with no message` : 'unknown error';
  }
  return raw.length > maxLength ? `${raw.slice(0, maxLength)}…` : raw;
}

// Join a summary sentence with the reason: "Could not load the draft: relation does not exist".
// A trailing period on the summary is dropped so the result reads as one sentence.
export function withReason(summary: string, error: unknown, maxLength: number = MAX_REASON_LENGTH): string {
  const head = summary.trim().replace(/[.:\s]+$/, '');
  return `${head}: ${failureReason(error, maxLength)}`;
}

// Who reads the message. `operator` is an admin/internal/cron surface — the reason goes in the text.
// `member` is a member-facing surface — the text stays plain and the reason goes to the error report.
export type FailureAudience = 'operator' | 'member';

export type FailureResponseInput = {
  // What the caller was trying to do, in plain words: "Could not load the draft". This is the half of
  // the message a person can act on without knowing the code.
  summary: string;
  // The caught value.
  error: unknown;
  // Stable machine code for the failure, e.g. `beacon_stream_unavailable`.
  code: string;
  // Coarse area + specific operation for the error report, same meaning as `reportError`.
  area: string;
  op: string;
  // HTTP status. Defaults to 503 — the common "a dependency we need did not answer" case.
  status?: number;
  // Extra debugging context for the error report. Never secrets, tokens, or keys.
  extra?: Record<string, unknown>;
  // Defaults to `operator`: naming the reason is the standard, and a member-facing route opts out
  // explicitly rather than by forgetting.
  audience?: FailureAudience;
};

// Report a caught error and answer with a response that explains itself.
//
// Always reports (so the stack and context reach the logs and Sentry), always carries a `code`, and
// always carries a `reference` that appears in both the response and the error report so a screenshot
// can be tied to a log line.
export function failureResponse(input: FailureResponseInput): NextResponse {
  const {
    summary, error, code, area, op, status = 503, extra, audience = 'operator',
  } = input;
  const reference = randomUUID().slice(0, 8);
  const reason = failureReason(error);

  reportError(error, { area, op, extra: { ...extra, reference, code } });

  return NextResponse.json(
    {
      ok: false,
      code,
      reference,
      message: audience === 'operator' ? `${summary.trim().replace(/[.:\s]+$/, '')}: ${reason}` : summary,
    },
    { status },
  );
}
