// Pure amount helpers for ServiceCredits.
//
// Extracted from the repository/ledger code on purpose: this is the deterministic money math
// (whole-credit -> integer minor-unit conversion, and the positive-amount guard) where a rounding
// or boundary bug is most costly, and where a unit test earns its keep. Keeping it here — with no
// database, ledger, or network import — is what makes it testable in isolation. See Rule 118
// (testing scope) and Rule 133.

// Convert a whole-credit amount to integer minor units (hundredths) for the ledger. Rounds to the
// nearest minor unit. Rejects anything that is not a finite, strictly-positive amount, and any
// amount that rounds down to zero minor units.
export function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('invalid_payload');
  }

  const minor = Math.round(amount * 100);
  if (minor <= 0) {
    throw new Error('invalid_payload');
  }

  return minor;
}

// Throw on any amount that is not finite and strictly positive. The shared guard for credit
// mutations (transfer, escrow, mint, fee, adjustment, reclaim).
export function ensurePositiveAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('invalid_payload');
  }
}
