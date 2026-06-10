// Sanitizing gate for bug reports.
//
// Two jobs, both run before a report can ever reach the (private) triage repo:
//   1. Redact obvious sensitive data (emails, phone numbers, card-like and token-like
//      strings) out of the user's text.
//   2. Classify risk. A report that trips any sensitive or abusive signal is marked
//      `flagged` so the pipeline holds it for human review instead of auto-publishing.
//
// This is deterministic, dependency-free, and runs synchronously on the submit path so
// the raw text is redacted the moment it is stored. It is a safety net, not a
// guarantee — the private triage repo is the primary defense (see rule 129). A later
// step may add a model-based restatement on top of this; this module intentionally does
// not call any external service so the submit path stays fast at scale.

import type { BugReportRiskLevel } from 'lib/bug-reports/constants';

export type BugReportRiskFlag =
  | 'pii_email'
  | 'pii_phone'
  | 'pii_card'
  | 'secret_token'
  | 'abusive_language';

const REDACTION_PLACEHOLDER: Record<BugReportRiskFlag, string> = {
  pii_email: '[redacted email]',
  pii_phone: '[redacted phone]',
  pii_card: '[redacted number]',
  secret_token: '[redacted secret]',
  abusive_language: '',
};

// Email addresses.
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// Phone numbers: 10+ digits allowing spaces, dashes, dots, parens, and a leading +.
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{8,}\d)/g;

// Card-like / long digit runs (13–16 digits, optionally grouped). Caught before the
// generic phone rule would, to give it the more specific placeholder.
const CARD_PATTERN = /\b(?:\d[ -]?){13,16}\b/g;

// Token / key / secret-looking strings: long runs of base64/hex-ish characters, or an
// explicit key=value where the value looks secret. Catches a session token pasted from
// an error message.
const SECRET_PATTERN =
  /\b(?:[A-Za-z0-9_-]{32,}|(?:sk|pk|ghp|gho|xox[baprs])[-_][A-Za-z0-9]{16,})\b/g;

// A deliberately small, conservative abusive-language signal. The goal is to HOLD for
// review (fail closed), not to censor — false positives only cost a human glance.
const ABUSIVE_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'asshole',
  'bastard',
  'slut',
  'whore',
  'retard',
  'faggot',
  'nigger',
];

const ABUSIVE_PATTERN = new RegExp(`\\b(?:${ABUSIVE_WORDS.join('|')})\\b`, 'i');

export type SanitizeResult = {
  redactedMessage: string;
  redactedContext: string | null;
  riskFlags: BugReportRiskFlag[];
  riskLevel: BugReportRiskLevel;
};

function redactField(value: string, flags: Set<BugReportRiskFlag>): string {
  let out = value;

  if (CARD_PATTERN.test(out)) {
    flags.add('pii_card');
    out = out.replace(CARD_PATTERN, REDACTION_PLACEHOLDER.pii_card);
  }
  if (SECRET_PATTERN.test(out)) {
    flags.add('secret_token');
    out = out.replace(SECRET_PATTERN, REDACTION_PLACEHOLDER.secret_token);
  }
  if (EMAIL_PATTERN.test(out)) {
    flags.add('pii_email');
    out = out.replace(EMAIL_PATTERN, REDACTION_PLACEHOLDER.pii_email);
  }
  if (PHONE_PATTERN.test(out)) {
    flags.add('pii_phone');
    out = out.replace(PHONE_PATTERN, REDACTION_PLACEHOLDER.pii_phone);
  }
  if (ABUSIVE_PATTERN.test(out)) {
    flags.add('abusive_language');
  }

  // Reset the lastIndex of the global regexes so reuse across calls is correct.
  CARD_PATTERN.lastIndex = 0;
  SECRET_PATTERN.lastIndex = 0;
  EMAIL_PATTERN.lastIndex = 0;
  PHONE_PATTERN.lastIndex = 0;

  return out;
}

export function sanitizeBugReport(message: string, context: string | null): SanitizeResult {
  const flags = new Set<BugReportRiskFlag>();

  const redactedMessage = redactField(message, flags);
  const redactedContext =
    context && context.trim().length > 0 ? redactField(context, flags) : null;

  const riskFlags = [...flags];
  const riskLevel: BugReportRiskLevel = riskFlags.length > 0 ? 'flagged' : 'clean';

  return { redactedMessage, redactedContext, riskFlags, riskLevel };
}
