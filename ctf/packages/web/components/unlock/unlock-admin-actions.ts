import type { Dispatch, SetStateAction } from 'react';
import type { UnlockSubmission } from 'lib/unlock/types';
import { failureText } from 'lib/errors/client-failure';

// Data + behavior helpers for the Unlock admin shell, kept out of the shell component so each handler is
// a small module-level function (the shell component itself stays under the rule-116 size/complexity
// limits). Behavior is identical to the previous inline handlers — same routes, headers, bodies,
// optimistic updates, messages, and refresh calls.

// One Quora URL change from the admin history read (GET /api/unlock/admin/quora-history).
export type QuoraHistoryEntry = {
  id: string;
  userId: string;
  previousUrl: string | null;
  newUrl: string;
  changedByUserId: string;
  source: 'directory_self' | 'directory_admin' | 'unlock_onboarding' | 'quora_deletion_survey';
  createdAtIso: string;
};

// State setters + router the action functions drive. Passed once from the shell as a stable-ish object.
export type UnlockAdminActionCtx = {
  router: { refresh: () => void };
  setBusyId: (value: number | null) => void;
  setReconciling: (value: boolean) => void;
  setError: (value: string | null) => void;
  setNotice: (value: string | null) => void;
  setSubmissions: Dispatch<SetStateAction<UnlockSubmission[]>>;
  setConfirmRevokeId: (value: number | null) => void;
  setSavingUrl: (value: boolean) => void;
  setEditError: (value: string | null) => void;
  closeEditor: () => void;
  setHistoryOpenUser: (value: string | null) => void;
  setHistoryByUser: Dispatch<SetStateAction<Record<string, QuoraHistoryEntry[]>>>;
  setHistoryLoadingUser: (value: string | null) => void;
};

type ErrorShape = { reason?: string; code?: string; message?: string } | null;

// Parse a JSON body, tolerating a non-JSON error body (returns null then).
async function readJson<T>(res: Response): Promise<T | null> {
  return (await res.json().catch(() => null)) as T | null;
}

// First present error string from a failed admin response, else a generic fallback.
function pickError(data: ErrorShape, status: number, verb: string): string {
  return data?.message ?? data?.reason ?? data?.code ?? `${verb} failed (${status}).`;
}

type ReconcileData = {
  ok?: boolean;
  granted?: number;
  alreadyGranted?: number;
  withheld?: number;
  failed?: number;
  errors?: { submissionId: number; message: string }[];
  reason?: string;
  code?: string;
  message?: string;
} | null;

// Failure message for a reconcile that could not grant every pending reward.
function reconcileFailureMessage(granted: number, failed: number, errors: { submissionId: number; message: string }[], heldNote: string): string {
  const reasons = errors.map((e) => `#${e.submissionId}: ${e.message}`).join('; ');
  return `Granted ${granted}. ${failed} could not be granted${reasons ? ` — ${reasons}` : ''}.${heldNote}`;
}

// Turn a successful reconcile response into the notice/error the shell shows. Pure — no state.
function summarizeReconcile(data: ReconcileData): { notice?: string; error?: string } {
  const { granted = 0, failed = 0, withheld = 0, errors = [] } = data ?? {};
  // Note any rewards the duplicate-identity guard held so the operator knows to make a determination.
  const heldNote = withheld > 0 ? ` ${withheld} held for duplicate-identity review.` : '';
  if (failed > 0) {
    return { error: reconcileFailureMessage(granted, failed, errors, heldNote) };
  }
  const grantedNote = granted > 0 ? `Granted ${granted} pending reward${granted === 1 ? '' : 's'}.` : 'No pending rewards to grant.';
  return { notice: grantedNote + heldNote };
}

// Reward self-heal: grant any approved verification whose reward is still pending. Idempotent.
export async function retryRewards(ctx: UnlockAdminActionCtx): Promise<void> {
  ctx.setReconciling(true);
  ctx.setError(null);
  ctx.setNotice(null);
  try {
    const res = await fetch('/api/unlock/admin/reconcile-rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    });
    const data = await readJson<ReconcileData>(res);
    if (!res.ok || !data?.ok) {
      ctx.setError(pickError(data ?? null, res.status, 'Retry'));
      return;
    }
    const summary = summarizeReconcile(data);
    if (summary.error) ctx.setError(summary.error);
    if (summary.notice) ctx.setNotice(summary.notice);
    // Refresh so the snapshot counts and reward pills reflect the freshly granted rewards.
    ctx.router.refresh();
  } catch (caught) {
    ctx.setError(failureText(caught, { area: 'unlock', op: 'retry_rewards', fallback: 'Network error. Try again.' }));
  } finally {
    ctx.setReconciling(false);
  }
}

// Apply an admin moderation decision to a pending submission.
export async function reviewSubmission(ctx: UnlockAdminActionCtx, id: number, reviewStatus: UnlockSubmission['reviewStatus']): Promise<void> {
  ctx.setBusyId(id);
  ctx.setError(null);
  ctx.setNotice(null);
  try {
    const res = await fetch(`/api/unlock/admin/submissions/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ reviewStatus }),
    });
    const data = await readJson<{ ok?: boolean; rewardWithheld?: boolean; reason?: string; code?: string }>(res);
    if (!res.ok) {
      ctx.setError(pickError(data ?? null, res.status, 'Review'));
      return;
    }
    // Optimistically reflect the decision, then refresh so the snapshot counts update too.
    ctx.setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, reviewStatus } : s)));
    if (data?.rewardWithheld) {
      ctx.setNotice('Approved, but the reward is held: this Quora profile is already on another account. Decide which account keeps it — Grant reward here, or Revoke it from the other.');
    }
    ctx.router.refresh();
  } catch (caught) {
    ctx.setError(failureText(caught, { area: 'unlock', op: 'review_submission', fallback: 'Network error. Try again.' }));
  } finally {
    ctx.setBusyId(null);
  }
}

// Duplicate-identity determination: grant a held reward to this account.
export async function grantReward(ctx: UnlockAdminActionCtx, id: number): Promise<void> {
  ctx.setBusyId(id);
  ctx.setError(null);
  ctx.setNotice(null);
  try {
    const res = await fetch(`/api/unlock/admin/submissions/${id}/grant-reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    });
    const data = await readJson<{ ok?: boolean; submission?: UnlockSubmission; holderUserId?: string; message?: string; reason?: string; code?: string }>(res);
    if (!res.ok || !data?.ok) {
      ctx.setError(pickError(data ?? null, res.status, 'Grant'));
      return;
    }
    if (data.submission) {
      const saved = data.submission;
      ctx.setSubmissions((prev) => prev.map((x) => (x.id === id ? saved : x)));
    }
    ctx.setNotice('Reward granted to this account.');
    ctx.router.refresh();
  } catch (caught) {
    ctx.setError(failureText(caught, { area: 'unlock', op: 'grant_reward', fallback: 'Network error. Try again.' }));
  } finally {
    ctx.setBusyId(null);
  }
}

// Duplicate-identity determination: revoke a reward (claws credits back and drops the account to
// support-only + rejected). Confirmed inline first by the caller.
export async function revokeReward(ctx: UnlockAdminActionCtx, id: number): Promise<void> {
  ctx.setBusyId(id);
  ctx.setError(null);
  ctx.setNotice(null);
  try {
    const res = await fetch(`/api/unlock/admin/submissions/${id}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ reviewNote: 'Reward revoked — duplicate Quora identity' }),
    });
    const data = await readJson<{ ok?: boolean; submission?: UnlockSubmission; creditsReclaimed?: boolean; reclaimAmount?: number; message?: string; reason?: string; code?: string }>(res);
    if (!res.ok || !data?.ok) {
      ctx.setError(pickError(data ?? null, res.status, 'Revoke'));
      return;
    }
    if (data.submission) {
      const saved = data.submission;
      ctx.setSubmissions((prev) => prev.map((x) => (x.id === id ? saved : x)));
    }
    ctx.setNotice(
      data.creditsReclaimed
        ? `Revoked and reclaimed ${data.reclaimAmount ?? 0} credits.`
        : 'Revoked. No credits to reclaim (none were granted, or the account already spent them).',
    );
    ctx.setConfirmRevokeId(null);
    ctx.router.refresh();
  } catch (caught) {
    ctx.setError(failureText(caught, { area: 'unlock', op: 'revoke_reward', fallback: 'Network error. Try again.' }));
  } finally {
    ctx.setBusyId(null);
  }
}

// Admin correction of a submission's Quora URL (re-validated + re-normalized server-side).
export async function saveUrl(ctx: UnlockAdminActionCtx, id: number, editUrl: string): Promise<void> {
  ctx.setSavingUrl(true);
  ctx.setEditError(null);
  try {
    const res = await fetch(`/api/unlock/admin/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify({ quoraProfileUrl: editUrl }),
    });
    const data = await readJson<{ ok?: boolean; submission?: UnlockSubmission; reason?: string; code?: string; message?: string }>(res);
    if (!res.ok || !data?.ok || !data.submission) {
      ctx.setEditError(pickError(data ?? null, res.status, 'Save'));
      return;
    }
    // Reflect the corrected (re-normalized) URL from the server, then refresh and close the editor.
    const saved = data.submission;
    ctx.setSubmissions((prev) => prev.map((s) => (s.id === id ? saved : s)));
    ctx.closeEditor();
    ctx.router.refresh();
  } catch (caught) {
    ctx.setEditError(failureText(caught, { area: 'unlock', op: 'save_url', fallback: 'Network error. Try again.' }));
  } finally {
    ctx.setSavingUrl(false);
  }
}

// Open/close a member's Quora URL history, fetching it the first time.
export async function toggleHistory(
  ctx: UnlockAdminActionCtx,
  userId: string,
  currentOpenUser: string | null,
  loaded: Record<string, QuoraHistoryEntry[]>,
): Promise<void> {
  if (currentOpenUser === userId) {
    ctx.setHistoryOpenUser(null);
    return;
  }
  ctx.setHistoryOpenUser(userId);
  if (loaded[userId]) {
    return;
  }
  ctx.setHistoryLoadingUser(userId);
  try {
    const res = await fetch(`/api/unlock/admin/quora-history?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
    const data = await readJson<{ history?: QuoraHistoryEntry[]; message?: string }>(res);
    if (res.ok && Array.isArray(data?.history)) {
      const history = data.history;
      ctx.setHistoryByUser((current) => ({ ...current, [userId]: history }));
    } else {
      ctx.setError(data?.message ?? 'Could not load Quora URL history.');
    }
  } catch (caught) {
    ctx.setError(failureText(caught, { area: 'unlock', op: 'toggle_history', fallback: 'Could not load Quora URL history.' }));
  } finally {
    ctx.setHistoryLoadingUser(null);
  }
}

export function historySourceLabel(source: QuoraHistoryEntry['source']): string {
  switch (source) {
    case 'unlock_onboarding':
      return 'set at onboarding';
    case 'directory_self':
      return 'changed by member in Directory';
    case 'directory_admin':
      return 'changed by an admin';
    case 'quora_deletion_survey':
      return 'reported removed, from the account survey';
    default:
      return source;
  }
}

// Empty-state message for the queue list, extracted so the list component stays simple.
export function queueEmptyMessage(searchQuery: string, tab: 'pending' | 'support-only' | 'all'): string {
  if (searchQuery) return 'No submissions match your search.';
  if (tab === 'pending') return 'No submissions waiting for review.';
  if (tab === 'support-only') return 'Nobody is on support-only access. Rejected, spam, and lapsed submissions land here.';
  return 'No submissions yet.';
}
