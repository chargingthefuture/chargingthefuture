import type {
  TrustEvidenceItem,
  TrustSignalMetrics,
  TrustUserExtension,
} from './types';
import { reportError } from 'lib/observability/report';
import {
  buildTrustEvidence,
  computeTrustSignalMetrics,
  getLatestTrustSnapshotAt,
  getTrustUserExtension as getTrustUserExtensionDb,
  insertTrustSignalSnapshot,
  setTrustDerivedEvidence,
} from './db';

export async function getTrustUserExtension(userId: string): Promise<TrustUserExtension> {
  return getTrustUserExtensionDb(userId);
}

// How long a computed snapshot is treated as fresh for the recompute-on-read path. Bounds the self
// GET's writes to at most once per window per user.
export const TRUST_SELF_REFRESH_MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface TrustSelfReadResult {
  extension: TrustUserExtension;
  refreshed: boolean;
}

// Read the caller's own trust panel, recomputing signals at most once per throttle window. The self
// endpoint is a GET (a read), so it must not perform an unbounded DB write on every request — a
// cross-site forced GET would otherwise append a snapshot row and rewrite evidence on each hit. We
// recompute only when the last snapshot is older than the window (or none exists yet), which keeps
// the panel fresh-on-load while bounding writes to once per window per user. A recompute failure is
// left to the caller to handle (it falls back to the last stored extension).
export async function readTrustSelfExtension(
  userId: string,
  maxAgeMs: number = TRUST_SELF_REFRESH_MIN_INTERVAL_MS,
): Promise<TrustSelfReadResult> {
  const lastSnapshotAt = await getLatestTrustSnapshotAt(userId);
  const isFresh = lastSnapshotAt !== null && Date.now() - lastSnapshotAt.getTime() < maxAgeMs;
  if (isFresh) {
    return { extension: await getTrustUserExtensionDb(userId), refreshed: false };
  }
  const { extension } = await refreshTrustSignalSnapshot(userId);
  return { extension, refreshed: true };
}

// Read the caller's own panel for a surface that renders it directly, rather than fetching
// `/api/trust/user/self` from the browser.
//
// Why this exists: the account hub, the home page, and the apps launcher all render the member's
// trust card server-side, and each of them used to call `getTrustUserExtension` — a plain read of
// whatever was last written. Nothing on those pages recomputed, so the card froze at the moment
// some other surface last hit the self API. In production that showed as a card whose every row was
// dated over a week earlier, still reporting a sign-in from that same day: not an out-of-date
// number, a snapshot of a member's participation from another week. A signal nothing refreshes is
// worse than no signal, because it reads as current.
//
// So the fix is not per-page: it is this one function, doing exactly what the self API route does —
// recompute on the same throttle, fall back to the last stored extension if the recompute throws —
// so every self surface stays in step and no future page can quietly reintroduce the frozen read.
// The throttle is what keeps it cheap: at most one recompute per window per member, no matter how
// many of these pages they open.
export async function readTrustSelfExtensionOrStored(userId: string): Promise<TrustUserExtension> {
  try {
    const { extension } = await readTrustSelfExtension(userId);
    return extension;
  } catch (error) {
    reportError(error, { area: 'trust', op: 'self_refresh' });
    return getTrustUserExtensionDb(userId);
  }
}

export interface TrustSnapshotResult {
  metrics: TrustSignalMetrics;
  evidence: TrustEvidenceItem[];
  extension: TrustUserExtension;
  snapshotId: string;
  generatedAt: string;
}

// Compute the caller's trust signal from real cross-plugin engagement, persist one snapshot row,
// and refresh the derived evidence on their extension.
export async function refreshTrustSignalSnapshot(userId: string): Promise<TrustSnapshotResult> {
  const nowIso = new Date().toISOString();
  const metrics = await computeTrustSignalMetrics(userId);
  const evidence = buildTrustEvidence(metrics, nowIso);
  const snapshot = await insertTrustSignalSnapshot(userId, metrics);
  const extension = await setTrustDerivedEvidence(userId, evidence);
  return {
    metrics,
    evidence,
    extension,
    snapshotId: snapshot.id,
    generatedAt: snapshot.createdAt,
  };
}
