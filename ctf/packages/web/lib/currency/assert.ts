// No-fiat-parity guard (issue #120 — the legal line).
//
// ServiceCredits is an internal credits unit with no fiat redemption path. A *single* ServiceCredits value
// must NEVER be rendered as a fiat equivalent (e.g. "2,420 credits ≈ $242 USD", "purchasing power",
// "real monetary value"). This guard detects that pattern in a single value/label string.
//
// IMPORTANT: apply this to an individual rendered value or label, NOT to a whole composed view.
// A compact layout that shows a fiat price field AND a separate "Accepts ServiceCredits" badge is
// allowed (two distinct fields) and is not a parity claim — each field passes this guard on its own.

function mentionsServiceCredits(lower: string): boolean {
  return /servicecredits|service[-\s]?credits|\bsc\b/.test(lower);
}

const EQUIVALENCE_CUE = /≈|~|=|\bequals?\b|\bworth\b/;
const FIAT_FIGURE =
  /[$€£¥₹₿]\s?\d|\b\d[\d,. ]*\s?(usd|eur|gbp|jpy|chf|cad|aud|cny|inr|brl|btc|dollars?|euros?)\b/;

/** True if `text` pegs a ServiceCredits value to a fiat/external-money equivalent. */
export function isFiatParityWithServiceCredits(text: string): boolean {
  const lower = text.toLowerCase();
  if (!mentionsServiceCredits(lower)) return false;
  if (/purchasing power|monetary value/.test(lower)) return true;
  return EQUIVALENCE_CUE.test(lower) && FIAT_FIGURE.test(lower);
}

/** Returns `text` unchanged, or throws if it claims a ServiceCredits↔fiat parity. */
export function assertNoFiatParity(text: string): string {
  if (isFiatParityWithServiceCredits(text)) {
    throw new Error(
      `No-fiat-parity violation: a ServiceCredits value must not be shown at a fiat equivalent. Offending text: ${JSON.stringify(
        text,
      )}`,
    );
  }
  return text;
}
