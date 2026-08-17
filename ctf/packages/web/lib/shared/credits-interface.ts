// Platform-owned interface for the ServiceCredits capability (owner decision 2026-08-03: strict
// plugin isolation). This file is the single sanctioned crossing point for ServiceCredits: plugins
// must import it, never lib/service-credits directly. Keep it narrow — a new export needs a
// reason, and re-exporting the whole repository is prohibited. Enforced by
// ctf/scripts/check-plugin-boundaries.mjs.
export {
  applyDisputeAdjustment,
  createEscrowHold,
  createTransfer,
  getOrCreateWallet,
  insertServiceCreditsAudit,
  mintGrant,
  refundEscrow,
  releaseEscrow,
} from 'lib/service-credits/repository';
