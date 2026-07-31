#!/usr/bin/env node
// Money-language gate for credits (issue #1181; statement of record: ctf/docs/DISCLAIMER.md).
//
// Fails when a line DESCRIBES ServiceCredits / in-app credits in money terms ("the money plugin",
// "credits are currency", "cash out your credits", "payment in credits"). It must NOT fire on the
// two legitimate classes of money-language:
//   1. explicit negations — "credits are not money", "never redeemable for cash";
//   2. real fiat amounts unrelated to credits — a LightHouse listing's actual rent currency,
//      Contributions' confirmed USD donations, the currencies lookup table.
//
// Heuristic: a line is a candidate when a credit term and a money term appear within a short
// window of each other; candidates are cleared by negation cues on the same line (or the line
// above, for wrapped markdown sentences) and by fiat-context allowlisting.
//
// This is an AUDIT HELPER, not a CI gate. Measured on the 2026-07-18 corpus, most remaining
// candidates are legitimate: the multi-currency value-field model (ServiceCredits is one option in
// a real currency field), negations wrapped across more than two lines, and historical audit notes
// quoting the very copy they fixed. A blocking gate at that precision would train agents to
// allowlist rather than think. Run it when sweeping for money-framing; every finding needs human
// judgment.
//
// Usage: node ctf/scripts/check-credits-money-language.mjs           (report, exit 0)
//        node ctf/scripts/check-credits-money-language.mjs --strict  (exit 1 on findings — only
//        for a future CI gate if precision ever gets there)

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EXTENSIONS = ['.md', '.mdc', '.ts', '.tsx', '.js', '.mjs', '.yaml', '.yml'];
const EXCLUDED_PATHS = [
  /^platform\//, // legacy reference-only tree
  /^design\//, // deprecated design submodule
  /node_modules\//,
  /\.next\//,
  /^ctf\/docs\/DISCLAIMER\.md$/, // the statement itself discusses the banned framings
  /^ctf\/scripts\/check-credits-money-language\.mjs$/, // this file quotes its own patterns
];

const CREDIT_TERM = /\b(?:service[ _-]?credits?|servicecredits?|in-app credits?|credits?)\b/i;
const MONEY_TERM = /\b(?:money|cash(?:ed|ing)?(?:[ -]?out)?|currency|currencies|legal tender|payments?|payouts?|paid out|withdraw(?:al|able|n)?|redeem(?:able|ed)?|fiat)\b/i;

// A candidate line is cleared when any of these appear on it (or the previous line, for wrapped
// prose): the money-word is being negated, scoped out, or used for real fiat unrelated to credits.
const CLEARING_CUES = [
  /\bnot\b/i,
  /\bnon[- ]?(?:fiat|cash|monetary|withdrawable)\b/i,
  /\bnever\b/i,
  /\bno\s+(?:money|cash|currency|financial|monetary|fiat|burn|external withdrawal)\b/i,
  /\bwithout\b/i,
  /\binstead of\b/i,
  /\brather than\b/i,
  /\bout of scope\b/i,
  /\bdenied\b/i,
  /\bforbid|\bban(?:ned)?\b|\bprohibit|\bnever use\b|\bdo not\b|\bdon't\b|\bavoid\b/i,
  /\berror\b/i, // "money-framing … is an error" style statements about the rule itself
  /\bdisclaimer\b/i,
  /\bnot[- ]money\b/i,
  // Real-fiat contexts that legitimately talk about currency/money and may also mention credits:
  /\brent\b/i,
  /\bdonat/i,
  /\bfundrais/i,
  /\bUSD\b|\bdollars?\b/,
  /\bexchange rate\b/i,
  /display currency|currency (?:code|symbol|field|column|preference|conversion)|preferred currency|local currency/i,
  /\bcurrencies\b.*\btable\b|\btable\b.*\bcurrencies\b/i,
  // Formance is a ledger product; its docs/config legitimately use accounting vocabulary:
  /\bformance\b/i,
  // Card/tarot-style names and unrelated identifiers:
  /\bcredit(?:ed|ing)\b/i, // "credited to your wallet" is a ledger verb, not a money claim
];

function trackedFiles() {
  const out = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out
    .split('\n')
    .filter(Boolean)
    .filter((f) => EXTENSIONS.some((ext) => f.endsWith(ext)))
    .filter((f) => !EXCLUDED_PATHS.some((re) => re.test(f)));
}

// The credit term and the money term must be near each other (same clause, not merely the same
// long line) for the line to count as "describing credits in money terms".
const WINDOW = 80;

function isCandidate(line) {
  const credit = line.match(CREDIT_TERM);
  const moneyMatches = [...line.matchAll(new RegExp(MONEY_TERM.source, 'gi'))];
  if (!credit || moneyMatches.length === 0) return false;
  return moneyMatches.some((m) => Math.abs(m.index - credit.index) <= WINDOW);
}

function isCleared(line, previousLine) {
  const scope = `${previousLine ?? ''} ${line}`;
  return CLEARING_CUES.some((re) => re.test(scope));
}

const strict = process.argv.includes('--strict');
const findings = [];

for (const file of trackedFiles()) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (!isCandidate(line)) return;
    if (isCleared(line, i > 0 ? lines[i - 1] : null)) return;
    findings.push({ file, line: i + 1, text: line.trim().slice(0, 160) });
  });
}

if (findings.length > 0) {
  console.error('Candidate money-framing of credits (review by hand — see ctf/docs/DISCLAIMER.md):\n');
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.text}`);
  }
  console.error(`\n${findings.length} candidate line(s). Genuine money-framing: rephrase per ctf/docs/BRAND_VOICE_LEXICON.md ("send"/"transfer"/"exchange", "non-fiat internal credits") or negate explicitly ("not money"). Legitimate multi-currency/fiat lines need no change.`);
  process.exit(strict ? 1 : 0);
}

console.log('No money-framing candidates found.');
