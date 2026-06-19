"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { SkillsHuntRound, SkillsHuntSubmission, SkillsHuntSubmissionStatus } from "lib/skills-hunt/types";
import { COLOR, promptRejectReason, type ReviewAction } from "./sha-shared";
import { SkillsHuntAdminFilters, SkillsHuntAdminBulkBar } from "./sha-filters";
import { SkillsHuntAdminTable } from "./sha-table";
import { SkillsHuntCreateRound } from "./sha-create-round";

type Props = { rounds: SkillsHuntRound[] };

function AdminHeader() {
  return (
    <header style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", margin: 0 }}>Skills Hunt — Moderation</h1>
        <div style={{ fontSize: 13, color: "#6B7280" }}>Review nominations, accept / reject / flag, bulk-act on a status set.</div>
      </div>
      <a href="/apps/skills-hunt" style={{ fontSize: 13, color: COLOR, textDecoration: "none" }}>← Open player shell</a>
    </header>
  );
}

export function SkillsHuntAdminShell({ rounds }: Props) {
  const isMobile = useIsMobile();
  const [activeRoundId, setActiveRoundId] = useState<string | null>(rounds[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<SkillsHuntSubmissionStatus>("pending");
  const [submissions, setSubmissions] = useState<SkillsHuntSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!activeRoundId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/skills-hunt/admin/rounds/${activeRoundId}/submissions?status=${statusFilter}&pageSize=100`);
      if (!res.ok) throw new Error("Failed to load submissions");
      const data = (await res.json()) as { items: SkillsHuntSubmission[] };
      setSubmissions(data.items);
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

  async function bulkReview(action: "accept" | "reject") {
    if (selected.size === 0) return;
    const notes = action === "reject" ? promptRejectReason() : null;
    if (action === "reject" && notes === null) return;
    // Defensive filter: only act on currently-pending submissions even if a
    // status change between select-and-act sneaks non-pending IDs in.
    const pendingIds = new Set(submissions.filter((s) => s.status === "pending").map((s) => s.id));
    const ids = Array.from(selected).filter((id) => pendingIds.has(id));
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
    const pendingIds = submissions.filter((s) => s.status === "pending").map((s) => s.id);
    if (selected.size === pendingIds.length) setSelected(new Set());
    else setSelected(new Set(pendingIds));
  }

  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const allPendingSelected = pendingCount > 0 && selected.size === pendingCount;

  return (
    <div style={{ ...(isMobile ? { minHeight: "100vh" } : { height: "100dvh", overflowY: "auto" }), background: "#0F1117", color: "#E8EAF0", fontFamily: "'Inter', system-ui, sans-serif", padding: "clamp(12px, 4vw, 24px)" }}>
      <AdminHeader />
      <SkillsHuntCreateRound />
      {rounds.length === 0 ? (
        <div style={{ color: "#6B7280" }}>No rounds yet. Use “New round” above to create the first one.</div>
      ) : (
        <>
          <SkillsHuntAdminFilters rounds={rounds} activeRoundId={activeRoundId} onRound={setActiveRoundId} statusFilter={statusFilter} onStatus={setStatusFilter} />
          <SkillsHuntAdminBulkBar count={selected.size} onAccept={() => void bulkReview("accept")} onReject={() => void bulkReview("reject")} onClear={() => setSelected(new Set())} />

          {error && <div style={{ marginBottom: 12, color: "#EF4444", fontSize: 13 }}>{error}</div>}
          {loading ? (
            <div style={{ color: "#6B7280", fontSize: 13 }}>Loading submissions…</div>
          ) : submissions.length === 0 ? (
            <div style={{ color: "#6B7280", fontSize: 13 }}>No submissions matching this filter.</div>
          ) : (
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <div style={{ minWidth: 720 }}>
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
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
