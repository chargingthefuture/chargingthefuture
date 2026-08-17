import { isDemoMode } from 'lib/feature-flags';
import { toMinorUnits } from 'lib/service-credits/amounts';

type FormanceTransactionResponse = {
  data?: {
    txid?: number | string;
    id?: number | string;
  };
  txid?: number | string;
  id?: number | string;
};

type LedgerPosting = {
  source: string;
  destination: string;
  amount: number;
  asset: string;
};

// Reads an environment variable and trims it, returning undefined when unset.
function readTrimmedEnv(name: string): string | undefined {
  return process.env[name]?.trim();
}

// Chooses the ledger book name for the current run. Demo mode (a recording
// session) uses the separate staging book (FORMANCE_LEDGER_STAGING); production
// uses FORMANCE_LEDGER. In demo mode there is deliberately no fallback to the
// production ledger, so no demo transaction can reach production financial data.
function resolveLedgerName(demoMode: boolean): string | undefined {
  return demoMode ? readTrimmedEnv('FORMANCE_LEDGER_STAGING') : readTrimmedEnv('FORMANCE_LEDGER');
}

// The credits asset used for every posting, with the shared default.
function resolveAsset(): string {
  return readTrimmedEnv('FORMANCE_ASSET') || 'SERVICE_CREDITS';
}

// Resolves the active Formance ledger configuration. Demo mode (a recording
// session) writes to a separate ledger book on the same Formance instance
// (FORMANCE_LEDGER_STAGING) so test transactions never touch the production
// ledger's real balances. API URL, token, and asset are shared because both
// books live on the one Formance instance. In demo mode we never fall back to the
// production ledger: if FORMANCE_LEDGER_STAGING is unset the config is treated as
// not configured, so no demo transaction can reach production financial data.
async function getFormanceConfig() {
  const apiUrl = readTrimmedEnv('FORMANCE_API_URL');
  const ledger = resolveLedgerName(await isDemoMode());

  if (!apiUrl || !ledger) {
    throw new Error('external_ledger_not_configured');
  }

  return {
    apiUrl: apiUrl.replace(/\/$/, ''),
    ledger,
    apiToken: readTrimmedEnv('FORMANCE_API_TOKEN') ?? null,
    asset: resolveAsset(),
  };
}

// Non-throwing config report for the admin status panel. getFormanceConfig() throws when unset,
// which is correct for the write path but not for a status read. Mirrors the same demo-vs-prod
// ledger choice so the panel reflects what the write path would actually use.
export async function getFormanceConfigStatus(): Promise<{
  configured: boolean;
  apiUrlSet: boolean;
  ledger: string | null;
  asset: string;
  demoMode: boolean;
}> {
  const apiUrl = readTrimmedEnv('FORMANCE_API_URL') ?? '';
  const demoMode = await isDemoMode();
  const ledger = resolveLedgerName(demoMode) ?? '';
  const asset = resolveAsset();
  return {
    configured: apiUrl.length > 0 && ledger.length > 0,
    apiUrlSet: apiUrl.length > 0,
    ledger: ledger.length > 0 ? ledger : null,
    asset,
    demoMode,
  };
}


function readTransactionId(payload: FormanceTransactionResponse): string | null {
  const candidate = payload.data?.txid ?? payload.data?.id ?? payload.txid ?? payload.id;
  if (candidate === undefined || candidate === null) {
    return null;
  }

  return String(candidate);
}

async function postTransactionToFormance(input: {
  reference: string;
  postings: LedgerPosting[];
  metadata: Record<string, unknown>;
}) {
  const config = await getFormanceConfig();

  const response = await fetch(`${config.apiUrl}/v2/${encodeURIComponent(config.ledger)}/transactions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.apiToken ? { authorization: `Bearer ${config.apiToken}` } : {}),
    },
    body: JSON.stringify({
      reference: input.reference,
      postings: input.postings.map((posting) => ({
        source: posting.source,
        destination: posting.destination,
        amount: toMinorUnits(posting.amount),
        asset: posting.asset,
      })),
      metadata: input.metadata,
    }),
  });

  if (!response.ok) {
    throw new Error('external_ledger_unavailable');
  }

  let payload: FormanceTransactionResponse = {};
  try {
    payload = (await response.json()) as FormanceTransactionResponse;
  } catch {
    // no-trace: a non-JSON or empty body keeps the default payload, and the post already succeeded.
  }

  return {
    transactionId: readTransactionId(payload),
  };
}

// Direct peer-to-peer transfer: the sender's wallet pays the recipient's wallet in one posting (no
// escrow). Mirrors the immediate-delivery model of collectTreasuryFee / applyDisputeAdjustment, which
// also move wallet -> wallet directly. Best-effort, like all Formance posts: the local ledger is
// authoritative and a failure here is queued for the reconciliation worker.
export async function postTransferToFormance(input: {
  senderUserId: string;
  recipientUserId: string;
  amount: number;
  idempotencyKey: string;
}) {
  const config = await getFormanceConfig();
  return postTransactionToFormance({
    reference: `service-credits:transfer:${input.senderUserId}:${input.idempotencyKey}`,
    postings: [
      {
        source: `wallet:${input.senderUserId}`,
        destination: `wallet:${input.recipientUserId}`,
        amount: input.amount,
        asset: config.asset,
      },
    ],
    metadata: {
      plugin: 'service-credits',
      senderUserId: input.senderUserId,
      recipientUserId: input.recipientUserId,
      flow: 'transfer',
    },
  });
}

export async function postEscrowHoldToFormance(input: {
  transferId: string;
  senderUserId: string;
  recipientUserId: string;
  amount: number;
  idempotencyKey: string;
}) {
  const config = await getFormanceConfig();
  return postTransactionToFormance({
    reference: `service-credits:escrow-hold:${input.senderUserId}:${input.idempotencyKey}`,
    postings: [
      {
        source: `wallet:${input.senderUserId}`,
        destination: `escrow:${input.transferId}`,
        amount: input.amount,
        asset: config.asset,
      },
    ],
    metadata: {
      plugin: 'service-credits',
      transferId: input.transferId,
      recipientUserId: input.recipientUserId,
      flow: 'escrow_hold',
    },
  });
}

export async function postEscrowReleaseToFormance(input: {
  escrowId: string;
  sourceUserId: string;
  destinationUserId: string;
  amount: number;
  idempotencyKey: string;
}) {
  const config = await getFormanceConfig();
  return postTransactionToFormance({
    reference: `service-credits:escrow-release:${input.sourceUserId}:${input.idempotencyKey}`,
    postings: [
      {
        source: `escrow:${input.escrowId}`,
        destination: `wallet:${input.destinationUserId}`,
        amount: input.amount,
        asset: config.asset,
      },
    ],
    metadata: {
      plugin: 'service-credits',
      escrowId: input.escrowId,
      sourceUserId: input.sourceUserId,
      destinationUserId: input.destinationUserId,
      flow: 'escrow_release',
    },
  });
}

export async function postEscrowRefundToFormance(input: {
  escrowId: string;
  sourceUserId: string;
  amount: number;
  idempotencyKey: string;
}) {
  const config = await getFormanceConfig();
  return postTransactionToFormance({
    reference: `service-credits:escrow-refund:${input.sourceUserId}:${input.idempotencyKey}`,
    postings: [
      {
        source: `escrow:${input.escrowId}`,
        destination: `wallet:${input.sourceUserId}`,
        amount: input.amount,
        asset: config.asset,
      },
    ],
    metadata: {
      plugin: 'service-credits',
      escrowId: input.escrowId,
      sourceUserId: input.sourceUserId,
      flow: 'escrow_refund',
    },
  });
}

export async function postMintToFormance(input: {
  targetUserId: string;
  amount: number;
  governanceTicketId: string;
  idempotencyKey: string;
}) {
  const config = await getFormanceConfig();
  return postTransactionToFormance({
    reference: `service-credits:mint:${input.targetUserId}:${input.idempotencyKey}`,
    postings: [
      {
        source: 'governance:mint',
        destination: `wallet:${input.targetUserId}`,
        amount: input.amount,
        asset: config.asset,
      },
    ],
    metadata: {
      plugin: 'service-credits',
      targetUserId: input.targetUserId,
      governanceTicketId: input.governanceTicketId,
      flow: 'governance_mint',
    },
  });
}

export async function postBurnToFormance(input: {
  targetUserId: string;
  amount: number;
  governanceTicketId: string;
  idempotencyKey: string;
}) {
  const config = await getFormanceConfig();
  return postTransactionToFormance({
    reference: `service-credits:burn:${input.targetUserId}:${input.idempotencyKey}`,
    postings: [
      {
        source: `wallet:${input.targetUserId}`,
        destination: 'governance:burn',
        amount: input.amount,
        asset: config.asset,
      },
    ],
    metadata: {
      plugin: 'service-credits',
      targetUserId: input.targetUserId,
      governanceTicketId: input.governanceTicketId,
      flow: 'governance_burn',
    },
  });
}

export async function postTreasuryFeeToFormance(input: {
  sourceUserId: string;
  treasuryUserId: string;
  amount: number;
  originPlugin: string;
  idempotencyKey: string;
}) {
  const config = await getFormanceConfig();
  return postTransactionToFormance({
    reference: `service-credits:treasury-fee:${input.sourceUserId}:${input.idempotencyKey}`,
    postings: [
      {
        source: `wallet:${input.sourceUserId}`,
        destination: `wallet:${input.treasuryUserId}`,
        amount: input.amount,
        asset: config.asset,
      },
    ],
    metadata: {
      plugin: 'service-credits',
      sourceUserId: input.sourceUserId,
      treasuryUserId: input.treasuryUserId,
      originPlugin: input.originPlugin,
      flow: 'treasury_fee_collect',
    },
  });
}

export async function postDisputeAdjustmentToFormance(input: {
  sourceUserId: string;
  destinationUserId: string;
  amount: number;
  disputeCaseId: string;
  idempotencyKey: string;
}) {
  const config = await getFormanceConfig();
  return postTransactionToFormance({
    reference: `service-credits:dispute-adjust:${input.sourceUserId}:${input.idempotencyKey}`,
    postings: [
      {
        source: `wallet:${input.sourceUserId}`,
        destination: `wallet:${input.destinationUserId}`,
        amount: input.amount,
        asset: config.asset,
      },
    ],
    metadata: {
      plugin: 'service-credits',
      disputeCaseId: input.disputeCaseId,
      sourceUserId: input.sourceUserId,
      destinationUserId: input.destinationUserId,
      flow: 'dispute_adjustment',
    },
  });
}

export async function postDeletionReclaimToFormance(input: {
  accountId: string;
  treasuryUserId: string;
  amount: number;
  deletionRequestId: string;
  idempotencyKey: string;
}) {
  const config = await getFormanceConfig();
  return postTransactionToFormance({
    reference: `service-credits:deletion-reclaim:${input.accountId}:${input.idempotencyKey}`,
    postings: [
      {
        source: `wallet:${input.accountId}`,
        destination: `wallet:${input.treasuryUserId}`,
        amount: input.amount,
        asset: config.asset,
      },
    ],
    metadata: {
      plugin: 'service-credits',
      accountId: input.accountId,
      treasuryUserId: input.treasuryUserId,
      deletionRequestId: input.deletionRequestId,
      flow: 'account_deletion_reclaim',
    },
  });
}
