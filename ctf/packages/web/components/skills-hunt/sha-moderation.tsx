"use client";

import { useCallback, useEffect, useState } from "react";
import type { SkillsHuntRound, SkillsHuntSubmission } from "lib/skills-hunt/types";
import { useTheme } from "@/hooks/useTheme";
import { promptRejectReason, getSkillsHuntAdminTokens, type ReviewAction, type SkillsHuntAdminStatusFilter } from "./sha-shared";
import { SkillsHuntAdminFilters, SkillsHuntAdminBulkBar } from "./sha-filters";
import { SkillsHuntAdminTable } from "./sha-table";

type RewardSummary = { totalCreditsPaid: number; rewardedSubmissionCount: number };

// Confirm the mass action with the real count of affected pending submissions before firing —
// a bulk accept pays each scout and a bulk reject can trip the rejection-rate guard, so neither
// should run on a stray click.
function bulkConfirmMessage(action: "accept" | "reject", count: number): string {
  const verb = action === "accept" ? "Accept" : "Reject";
  const consequence = action === "accept"
    ? "Each accepted nomination pays the configured reward once."
    : "This cannot be undone.";
  return `${verb} ${count} selected submission${count === 1 ? "" : "s"}? ${consequence}`;
}

function RewardBanner({ round, summary }: { round: SkillsHuntRound | null; summary: RewardSummary | null }) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  if (!round) return null;
  const per = round.rewardCreditsPerAccept;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", padding: "10px 14px", marginBottom: 16, borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)", fontSize: 12.5, color: "#D1FAE5" }}>
      {per > 0 ? (
        <span>Reward: <b>{per} ServiceCredits</b> per accepted nomination{round.rewardPerUserRoundCap !== null ? ` · cap ${round.rewardPerUserRoundCap} per scout` : ""}.</span>
      ) : (
        <span style={{ color: t.SUBTLE }}>No ServiceCredits reward on this round — set one in the Rounds tab. Accepting still awards points and badges.</span>
      )}
      {summary && summary.rewardedSubmissionCount > 0 && (
        <span style={{ color: t.SUBTLE }}>Paid so far: <b style={{ color: "#22C55E" }}>{summary.totalCreditsPaid}</b> to {summary.rewardedSubmissionCount} scout{summary.rewardedSubmissionCount === 1 ? "" : "s"}.</span>
      )}
    </div>
  );
}

export function SkillsHuntModeration({ rounds, activeRoundId, onRoundChange }: {
  rounds: SkillsHuntRound[];
  activeRoundId: string | null;
  onRoundChange: (id: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const [statusFilter, setStatusFilter] = useState<SkillsHuntAdminStatusFilter>("all");
  const [submissions, setSubmissions] = useState<SkillsHuntSubmission[]>([]);
  const [round, setRound] = useState<SkillsHuntRound | null>(null);
  const [rewardSummary, setRewardSummary] = useState<RewardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!activeRoundId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/skills-hunt/admin/rounds/${activeRoundId}/submissions?pageSize=100${statusFilter === "all" ? "" : `&status=${statusFilter}`}`);
      if (!res.ok) throw new Error("Failed to load submissions");
      const data = (await res.json()) as { items: SkillsHuntSubmission[]; round?: SkillsHuntRound | null; rewardSummary?: RewardSummary | null };
      setSubmissions(data.items);
      setRound(data.round ?? null);
      setRewardSummary(data.rewardSummary ?? null);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [activeRoundId, statusFilter]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function reviewOne(submissionId: string, action: ReviewAction, notes: string | null) {
    setActing(submissionId);
    try {
      const res = await fetch(`/api/skills-hunt/admin/submissions/${submissionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ action, notes }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? "Review failed");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Review failed");
    } finally {
      setActing(null);
    }
  }

  async function reviewAndRefresh(id: string, action: ReviewAction, notes: string | null) {
    await reviewOne(id, action, notes);
    await refresh();
  }

  function onReject(id: string) {
    const reason = promptRejectReason();
    if (reason === null) return;
    void reviewAndRefresh(id, "reject", reason);
  }

  // Remove = soft-delete. Use for a void that should not count against the scout
  // (a duplicate, a test row, an admin mistake) — unlike Reject, it does not raise
  // the scout's rejection rate. It does not reverse any ServiceCredits reward.
  async function onRemove(id: string) {
    if (!window.confirm("Remove this submission? It is soft-deleted and no longer counts toward scores, missions, or the scout's reputation — unlike Reject, it does not count against the scout. This does not reverse any ServiceCredits reward; burn that separately if needed.")) return;
    setActing(id);
    try {
      const res = await fetch(`/api/skills-hunt/admin/submissions/${id}/remove`, {
        method: "POST",
        headers: { "x-ctf-csrf": "1" },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Unable to remove submission.");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to remove submission.");
    } finally {
      setActing(null);
    }
    await refresh();
  }

  // Restore = undo a removal. The row comes back with the status it had when it was removed, so a
  // submission that was flagged returns flagged and can then be un-flagged. Without this, Remove is
  // a one-way door: the row sits in the list marked Removed with nothing an admin can do to it.
  async function onRestore(id: string) {
    setActing(id);
    try {
      const res = await fetch(`/api/skills-hunt/admin/submissions/${id}/restore`, {
        method: "POST",
        headers: { "x-ctf-csrf": "1" },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Unable to restore submission.");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to restore submission.");
    } finally {
      setActing(null);
    }
    await refresh();
  }

  async function bulkReview(action: "accept" | "reject") {
    if (selected.size === 0) return;
    const pendingIds = new Set(submissions.filter((s) => s.status === "pending" && s.deletedAtIso === null).map((s) => s.id));
    const ids = Array.from(selected).filter((id) => pendingIds.has(id));
    if (ids.length === 0) return;
    if (!window.confirm(bulkConfirmMessage(action, ids.length))) return;
    const notes = action === "reject" ? promptRejectReason() : null;
    if (action === "reject" && notes === null) return;
    for (const id of ids) {
      // Sequential so the leaderboard rebuilds settle row-by-row.
      await reviewOne(id, action, notes);
    }
    await refresh();
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const pendingIds = submissions.filter((s) => s.status === "pending" && s.deletedAtIso === null).map((s) => s.id);
    if (selected.size === pendingIds.length) setSelected(new Set());
    else setSelected(new Set(pendingIds));
  }

  const pendingCount = submissions.filter((s) => s.status === "pending" && s.deletedAtIso === null).length;
  const allPendingSelected = pendingCount > 0 && selected.size === pendingCount;

  if (rounds.length === 0) {
    return <div style={{ color: t.MUTED, fontSize: 13 }}>No rounds yet. Create one in the Rounds tab before moderating.</div>;
  }

  return (
    <>
      <SkillsHuntAdminFilters rounds={rounds} activeRoundId={activeRoundId} onRound={onRoundChange} statusFilter={statusFilter} onStatus={setStatusFilter} />
      <RewardBanner round={round} summary={rewardSummary} />
      <SkillsHuntAdminBulkBar count={selected.size} onAccept={() => void bulkReview("accept")} onReject={() => void bulkReview("reject")} onClear={() => setSelected(new Set())} />

      {error && <div style={{ marginBottom: 12, color: "#EF4444", fontSize: 13 }}>{error}</div>}
      {loading ? (
        <div style={{ color: t.MUTED, fontSize: 13 }}>Loading submissions…</div>
      ) : submissions.length === 0 ? (
        <div style={{ color: t.MUTED, fontSize: 13 }}>No submissions matching this filter.</div>
      ) : (
        <SkillsHuntAdminTable
          submissions={submissions}
          selected={selected}
          acting={acting}
          allPendingSelected={allPendingSelected}
          onToggleAll={toggleAllVisible}
          onToggle={toggleOne}
          onAccept={(id) => void reviewAndRefresh(id, "accept", null)}
          onReject={onReject}
          onFlag={(id) => void reviewAndRefresh(id, "flag", null)}
          onUnflag={(id) => void reviewAndRefresh(id, "unflag", null)}
          onRemove={(id) => void onRemove(id)}
          onRestore={(id) => void onRestore(id)}
        />
      )}
    </>
  );
}
