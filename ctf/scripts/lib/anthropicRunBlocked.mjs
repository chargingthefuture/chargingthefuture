// Shared "paused, not broken" signal for every script that calls the Anthropic API from a workflow.
//
// This project funds its API some months and not others, so a scheduled run that cannot pay for
// its model call is red for long stretches by design. `workflow-health-check.yml` sweeps failing
// runs into one triage issue; a run whose failure annotation carries
// `CTF_RUN_BLOCKED_EXTERNAL:<reason>` is listed there under "Paused, not broken" instead, and no
// agent goes hunting for a bug in a pipeline that is working as written. The emitter pattern was
// first written in proposeSkillPromotions.mjs (which keeps its own, fuller copy because it reports
// per-skill); this module is the same reading for the one-call scripts.
//
// Every message here also names the manual route — the slash command in `.claude/commands/` that
// does the same job from a chat session — because the owner has a chat agent even when the
// account has no API credit, and the product must not wait on the bill.

import { appendFileSync } from "node:fs";

export const BLOCKED_EXTERNAL_MARKER = "CTF_RUN_BLOCKED_EXTERNAL";

const REASONS = {
  no_credit: {
    headline: "the Anthropic account is out of credit",
    detail:
      "This is a billing state, not a defect. The script, the inputs, and the repository are fine; " +
      "the model call simply cannot be paid for right now.",
    whatToDo:
      "Add funds to the Anthropic account whenever suits. Nothing in this repo needs changing.",
  },
  no_key: {
    headline: "no Anthropic API key is configured",
    detail: "ANTHROPIC_API_KEY is not set in this run, so the model call cannot be made.",
    whatToDo: "Restore the key in Infisical (production). Nothing in this repo needs changing.",
  },
  key_rejected: {
    headline: "the Anthropic API rejected the key",
    detail:
      "The key the run holds is not accepted (HTTP 401). It was rotated or revoked outside this repo.",
    whatToDo: "Set a current key in Infisical (production). Nothing in this repo needs changing.",
  },
  access_denied: {
    headline: "the Anthropic API denied access",
    detail: "The key is valid but is not allowed to make this call (permission_error).",
    whatToDo:
      "Check the key’s permissions in the Anthropic dashboard. Nothing in this repo needs changing.",
  },
  rate_limited: {
    headline: "the Anthropic API rate limit was hit",
    detail: "The account’s request budget for this window is spent (HTTP 429).",
    whatToDo: "Nothing. The next scheduled run retries.",
  },
  vendor_down: {
    headline: "the Anthropic API is unavailable",
    detail: "The vendor answered with a server error or an overloaded response.",
    whatToDo: "Nothing. The next scheduled run retries.",
  },
};

// Vendor error types, from the API's documented error shape. The type decides the reason whenever
// the body carries one — never the prose, and never the status alone.
const REASON_BY_ERROR_TYPE = {
  billing_error: "no_credit",
  authentication_error: "key_rejected",
  permission_error: "access_denied",
  rate_limit_error: "rate_limited",
  api_error: "vendor_down",
  overloaded_error: "vendor_down",
};

function vendorErrorTypeFrom(body) {
  try {
    const errorType = JSON.parse(body)?.error?.type;
    return typeof errorType === "string" && errorType.trim() ? errorType.trim() : null;
  } catch {
    // no-trace: a non-JSON body is an expected shape; the status code alone decides below.
    return null;
  }
}

// Which outside state a failed model call is, or null when it is a defect in this repo (a malformed
// request, an unknown model id) and must read as one. Two rules keep a defect from ever dressing up
// as a funding problem: a 403 with no readable type stays null (billing_error and permission_error
// share that status), and a 400 is `no_credit` only when the message names the credit balance.
export function apiUnavailableReason(status, body) {
  const errorType = vendorErrorTypeFrom(body ?? "");
  if (errorType && REASON_BY_ERROR_TYPE[errorType]) return REASON_BY_ERROR_TYPE[errorType];
  if (status === 402) return "no_credit";
  if (status === 400) return /credit balance/i.test(body ?? "") ? "no_credit" : null;
  if (status === 401) return "key_rejected";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "vendor_down";
  return null;
}

// Error thrown for a non-OK answer from the API. Keeps the message the scripts always printed
// ("Anthropic API error: <status> <body>") and carries the status and body so the catch block can
// tell an account state from a defect.
export class AnthropicApiError extends Error {
  constructor(status, body) {
    super(`Anthropic API error: ${status} ${body}`);
    this.name = "AnthropicApiError";
    this.status = status;
    this.body = body;
  }
}

export async function anthropicApiError(response) {
  return new AnthropicApiError(response.status, await response.text().catch(() => ""));
}

function writeStepSummary(script, markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  try {
    appendFileSync(summaryPath, `${markdown}\n`);
  } catch (summaryError) {
    // Non-fatal: the log already carries the same text. Say why rather than leave a silent gap.
    console.error(
      `${script}: could not write the job summary: ${summaryError?.message || summaryError}`,
    );
  }
}

// Report a run as paused by an outside state. `reason` is a key of REASONS. `manualRoute` is the
// slash command that does the same job from a chat session. `nothingLost` says, in one sentence,
// why no work is lost (the next run picks the same input up). Prints the annotation the health
// check reads, writes the step summary, and sets the exit code to 1: the run stays red on purpose,
// because a scheduled run that produced nothing must not look healthy.
export function reportRunBlocked({
  script,
  reason,
  manualRoute,
  nothingLost,
  status,
  vendorMessage,
}) {
  const text = REASONS[reason];
  const title = `${script} paused — ${text.headline} (not a code failure).`;
  const manual = `Until then, run ${manualRoute} in a Claude Code session to do the same job by hand.`;
  const oneLine = `${text.detail} ${text.whatToDo} ${manual} ${nothingLost} [${BLOCKED_EXTERNAL_MARKER}:${reason}]`;

  console.error(`${script}: ${title}`);
  console.error(`${script}: ${text.detail} ${text.whatToDo}`);
  console.error(`${script}: ${manual}`);
  if (vendorMessage) console.error(`${script}: the API said (HTTP ${status}): ${vendorMessage}`);

  if (process.env.GITHUB_ACTIONS) {
    // Annotations are single-line; collapse newlines and neutralize the :: delimiter.
    const clean = (value) => String(value).replace(/\r?\n/g, " ").replace(/::/g, ":");
    console.log(`::error title=${clean(title)}::${clean(oneLine)}`);
    writeStepSummary(
      script,
      [
        `## ${title}`,
        "",
        text.detail,
        "",
        vendorMessage ? `**The API said (HTTP ${status}):** ${vendorMessage}\n` : "",
        `**What to do:** ${text.whatToDo}`,
        "",
        `**Manual route:** ${manual}`,
        "",
        `**Is any work lost?** No. ${nothingLost}`,
        "",
        "This run is red on purpose: a scheduled run that produced nothing must not look healthy.",
      ].join("\n"),
    );
  }
  process.exitCode = 1;
}

// One call for a catch block: if `error` is an API answer that names an outside state, report it
// and return true; otherwise return false so the caller prints its usual failure. It never sees a
// missing key: each script checks ANTHROPIC_API_KEY before the model call and reports its absence
// itself with `reportRunBlocked({ reason: 'no_key', ... })`.
export function reportIfRunBlocked({ script, error, manualRoute, nothingLost }) {
  if (error instanceof AnthropicApiError) {
    const reason = apiUnavailableReason(error.status, error.body);
    if (!reason) return false;
    let vendorMessage = error.body.slice(0, 300);
    try {
      vendorMessage = JSON.parse(error.body)?.error?.message || vendorMessage;
    } catch {
      // no-trace: a non-JSON body is an expected shape; the raw excerpt above is the message.
    }
    reportRunBlocked({
      script,
      reason,
      manualRoute,
      nothingLost,
      status: error.status,
      vendorMessage,
    });
    return true;
  }
  return false;
}
