import type {
  TrustEvidenceItem,
  TrustSignalMetrics,
  TrustStatus,
  TrustUserExtension,
  TrustVisibility,
} from './types';
import {
  applyAdminVerification,
  buildTrustEvidence,
  computeTrustSignalMetrics,
  getTrustUserExtension as getTrustUserExtensionDb,
  insertTrustSignalSnapshot,
  setTrustDerivedEvidence,
  updateTrustVisibility as updateTrustVisibilityDb,
} from './db';

export async function getTrustUserExtension(userId: string): Promise<TrustUserExtension> {
  return getTrustUserExtensionDb(userId);
}

export interface TrustSnapshotResult {
  metrics: TrustSignalMetrics;
  evidence: TrustEvidenceItem[];
  extension: TrustUserExtension;
  snapshotId: string;
  generatedAt: string;
}

// Compute the caller's trust signal from real cross-plugin engagement, persist one snapshot row,
// and refresh the derived evidence on their extension. Does NOT change trust_status (admin-only).
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

export async function setTrustVisibility(
  userId: string,
  visibility: TrustVisibility,
): Promise<TrustUserExtension> {
  return updateTrustVisibilityDb(userId, visibility);
}

// Apply an admin verification decision: set status and append an admin evidence note.
export async function applyTrustAdminVerification(params: {
  targetUserId: string;
  status: TrustStatus;
  actorUserId: string;
  note?: string;
}): Promise<TrustUserExtension> {
  const { targetUserId, status, actorUserId, note } = params;
  const summary =
    status === 'verified'
      ? 'Verified by an administrator'
      : 'Flagged for review by an administrator';
  const adminEvidence: TrustEvidenceItem = {
    type: 'admin-verification',
    summary,
    details: note && note.trim().length > 0 ? note.trim() : undefined,
    createdAt: new Date().toISOString(),
    createdBy: actorUserId,
  };
  return applyAdminVerification(targetUserId, status, adminEvidence);
}
