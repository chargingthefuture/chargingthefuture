"use client";

import { useCallback, useEffect, useState } from "react";
import type { SkillsHuntRound, SkillsHuntSubmission } from "lib/skills-hunt/types";
import { useTheme } from "@/hooks/useTheme";
import { promptRejectReason, getSkillsHuntAdminTokens, type ReviewAction, type SkillsHuntAdminStatusFilter } from "./sha-shared";
import { SkillsHuntAdminFilters, SkillsHuntAdminBulkBar } from "./sha-filters";
import { SkillsHuntAdminTable } from "./sha-table";
import { Pager } from "@/components/shared/pager";

// One screenful of nominations at a time. It was one request for up to 100 rows and no way to
// reach row 101 (owner report, 2026-09-20): the queue read as an endless scroll, and on a phone
// each nomination is a tall card with four action buttons, so a hundred of them is a scroll nobody
// finishes. Twenty-five is what the route's own default page is near, and it keeps Previous/Next
// in reach without a long trip back up.
const MODERATION_PAGE_SIZE = 25;

type RewardSummary = { totalCreditsPaid: number; rewardedSubmissionCount: number };

// Confirm the mass action with the real count before firing — a bulk accept pays each scout and a
// bulk reject can trip the rejection-rate guard, so neither should run on a stray click. The
// confirm says what will happen; it never withholds the action. Any selected row is included,
// whatever state it is in, and a removed one is made live again by the review (owner directive
// 2026-08-28: this is the admin page).
function bulkConfirmMessage(action: "accept" | "reject", count: number): string {
  const verb = action === "accept" ? "Accept" : "Reject";
  const consequence = action === "accept"
    ? "Each accepted nomination pays the configured reward once."
    : "Each rejected nomination counts toward that scout's rejection rate.";
  return `${verb} ${count} selected submission${count === 1 ? "" : "s"}? ${consequence} Any removed submission in the selection is restored by this.`;
}

type SubmissionPage = {
  items: SkillsHuntSubmission[];
  total?: number;
  round?: SkillsHuntRound | null;
  rewardSummary?: RewardSummary | null;
};

// One page of the queue. Throws with the route's own sentence when it refuses — this is an
// operator screen, so the reason belongs on it rather than behind a fixed fallback (rule 137).
async function fetchSubmissionPage(
  roundId: string,
  statusFilter: SkillsHuntAdminStatusFilter,
  page: number,
): Promise<SubmissionPage> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(MODERATION_PAGE_SIZE) });
  if (statusFilter !== "all") query.set("status", statusFilter);
  const res = await fetch(`/api/skills-hunt/admin/rounds/${roundId}/submissions?${query}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Unable to load submissions (${res.status}).`);
  }
  return (await res.json()) as SubmissionPage;
}

// What the round is for, shown above the Accept/Reject controls. The round's description is the
// only place its purpose is written, and a reviewer working a list of names cannot otherwise tell
// whether a nomination belongs here (owner report: a nomination unrelated to the round's subject
// was accepted and paid its reward).
function RoundPurpose({ round }: { round: SkillsHuntRound | null }) {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  if (!round?.description) return null;
  return (
    <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER}`, fontSize: 12.5, color: t.SUBTLE, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
      <span style={{ color: t.TITLE, fontWeight: 700 }}>{round.name} is looking for: </span>
      {round.description}
    </div>
  );
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Changing the round or the filter is a different list, so it starts at its first page. Without
  // this, narrowing a nine-page list to a one-page filter from page 4 shows an empty screen that
  // reads as "no submissions" when there are plenty.
  useEffect(() => { setPage(1); }, [activeRoundId, statusFilter]);

  const refresh = useCallback(async () => {
    if (!activeRoundId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSubmissionPage(activeRoundId, statusFilter, page);
      setSubmissions(data.items);
      setTotal(data.total ?? data.items.length);
      setRound(data.round ?? null);
      setRewardSummary(data.rewardSummary ?? null);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load submissions.");
    } finally {
      setLoading(false);
    }
  }, [activeRoundId, statusFilter, page]);

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
    const allIds = new Set(submissions.map((s) => s.id));
    const ids = Array.from(selected).filter((id) => allIds.has(id));
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
    const allIds = submissions.map((s) => s.id);
    if (selected.size === allIds.length) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  const shownCount = submissions.length;
  const allSelected = shownCount > 0 && selected.size === shownCount;
  const pageCount = Math.max(1, Math.ceil(total / MODERATION_PAGE_SIZE));

  if (rounds.length === 0) {
    return <div style={{ color: t.MUTED, fontSize: 13 }}>No rounds yet. Create one in the Rounds tab before moderating.</div>;
  }

  return (
    <>
      <SkillsHuntAdminFilters rounds={rounds} activeRoundId={activeRoundId} onRound={onRoundChange} statusFilter={statusFilter} onStatus={setStatusFilter} />
      <RoundPurpose round={round} />
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
          allSelected={allSelected}
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
      {/* Select all and the bulk bar act on the rows on screen, which is this page — the count in
          the confirm says how many, so a bulk action can never reach a row nobody has looked at. */}
      <Pager page={page} pageCount={pageCount} loading={loading} onPageChange={setPage} accent={t.ACCENT} subtle={t.SUBTLE} border={t.BORDER} />
    </>
  );
}
