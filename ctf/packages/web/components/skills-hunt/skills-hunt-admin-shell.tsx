"use client";

import { useCallback, useEffect, useState } from "react";
import type { SkillsHuntRound, SkillsHuntSubmission, SkillsHuntSubmissionStatus } from "lib/skills-hunt/types";

const COLOR = "#A855F7";
const STATUS_OPTIONS: Array<{ key: SkillsHuntSubmissionStatus; label: string; color: string }> = [
  { key: "pending",  label: "Pending",  color: "#F59E0B" },
  { key: "accepted", label: "Accepted", color: "#22C55E" },
  { key: "rejected", label: "Rejected", color: "#EF4444" },
  { key: "flagged",  label: "Flagged",  color: COLOR },
];

const REJECT_REASONS = [
  "Insufficient social proof / Quora unverifiable",
  "Display name violates spec (2–100 alphanumeric+spaces)",
  "Skills don't match taxonomy and no valid proposed skill",
  "Suspected duplicate of an existing accepted submission",
  "Suspected trafficker / bad-faith actor",
  "Other (see notes)",
];

type Props = { rounds: SkillsHuntRound[] };

export function SkillsHuntAdminShell({ rounds }: Props) {
  const [activeRoundId, setActiveRoundId] = useState<string | null>(rounds[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<SkillsHuntSubmissionStatus>("pending");
  const [submissions, setSubmissions] = useState<SkillsHuntSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null); // submissionId currently in-flight

  const refresh = useCallback(async () => {
    if (!activeRoundId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/skills-hunt/admin/rounds/${activeRoundId}/submissions?status=${statusFilter}&pageSize=100`);
      if (!res.ok) throw new Error("Failed to load submissions");
      const data = await res.json() as { items: SkillsHuntSubmission[] };
      setSubmissions(data.items);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [activeRoundId, statusFilter]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function reviewOne(submissionId: string, action: "accept" | "reject" | "flag", notes: string | null) {
    setActing(submissionId);
    try {
      const res = await fetch(`/api/skills-hunt/admin/submissions/${submissionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ action, notes }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw new Error(err.message ?? "Review failed");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Review failed");
    } finally {
      setActing(null);
    }
  }

  async function bulkReview(action: "accept" | "reject") {
    if (selected.size === 0) return;
    const notes = action === "reject" ? promptRejectReason() : null;
    if (action === "reject" && notes === null) return;
    // Defensive filter: only act on currently-pending submissions even if a
    // status change between select-and-act sneaks non-pending IDs in.
    const pendingIds = new Set(submissions.filter(s => s.status === "pending").map(s => s.id));
    const ids = Array.from(selected).filter(id => pendingIds.has(id));
    for (const id of ids) {
      // Sequential so the leaderboard rebuilds settle row-by-row.
      await reviewOne(id, action, notes);
    }
    await refresh();
  }

  function promptRejectReason(): string | null {
    if (typeof window === "undefined") return null;
    const numbered = REJECT_REASONS.map((r, i) => `${i + 1}. ${r}`).join("\n");
    const choice = window.prompt(`Reject reason (1-${REJECT_REASONS.length}) or free text:\n${numbered}`, "1");
    if (choice == null) return null;
    const idx = Number.parseInt(choice, 10);
    if (Number.isInteger(idx) && idx >= 1 && idx <= REJECT_REASONS.length) return REJECT_REASONS[idx - 1];
    return choice.trim() || null;
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    // Only pending rows are actionable; never select accepted/rejected/flagged.
    const pendingIds = submissions.filter(s => s.status === "pending").map(s => s.id);
    if (selected.size === pendingIds.length) setSelected(new Set());
    else setSelected(new Set(pendingIds));
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F1117", color: "#E8EAF0", fontFamily: "'Inter', system-ui, sans-serif", padding: 24 }}>
      <header style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", margin: 0 }}>Skills Hunt — Moderation</h1>
          <div style={{ fontSize: 13, color: "#6B7280" }}>Review nominations, accept / reject / flag, bulk-act on a status set.</div>
        </div>
        <a href="/apps/skills-hunt" style={{ fontSize: 13, color: COLOR, textDecoration: "none" }}>← Open player shell</a>
      </header>

      {rounds.length === 0 ? (
        <div style={{ color: "#6B7280" }}>No rounds yet. Create one before moderating.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {rounds.map(r => (
              <button
                key={r.id}
                onClick={() => setActiveRoundId(r.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  background: activeRoundId === r.id ? `${COLOR}25` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${activeRoundId === r.id ? COLOR + "60" : "rgba(255,255,255,0.08)"}`,
                  color: activeRoundId === r.id ? COLOR : "#9CA3AF",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {r.name} <span style={{ opacity: 0.6 }}>· {r.status}</span>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  background: statusFilter === s.key ? `${s.color}25` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${statusFilter === s.key ? s.color + "60" : "rgba(255,255,255,0.08)"}`,
                  color: statusFilter === s.key ? s.color : "#9CA3AF",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Bulk toolbar */}
          {selected.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 12, borderRadius: 10, background: `${COLOR}10`, border: `1px solid ${COLOR}30` }}>
              <span style={{ fontSize: 12, color: COLOR, fontWeight: 600 }}>{selected.size} selected</span>
              <button onClick={() => bulkReview("accept")} style={{ padding: "6px 14px", borderRadius: 8, background: "#22C55E", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Bulk accept</button>
              <button onClick={() => bulkReview("reject")} style={{ padding: "6px 14px", borderRadius: 8, background: "#EF4444", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Bulk reject</button>
              <button onClick={() => setSelected(new Set())} style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Clear</button>
            </div>
          )}

          {error && <div style={{ marginBottom: 12, color: "#EF4444", fontSize: 13 }}>{error}</div>}
          {loading ? (
            <div style={{ color: "#6B7280", fontSize: 13 }}>Loading submissions…</div>
          ) : submissions.length === 0 ? (
            <div style={{ color: "#6B7280", fontSize: 13 }}>No submissions matching this filter.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#6B7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  <th style={{ padding: "8px 6px", width: 32 }}>
                    <input type="checkbox" checked={selected.size > 0 && selected.size === submissions.length} onChange={toggleAllVisible} />
                  </th>
                  <th style={{ padding: "8px 6px" }}>Submitter</th>
                  <th style={{ padding: "8px 6px" }}>Display Name</th>
                  <th style={{ padding: "8px 6px" }}>Skills</th>
                  <th style={{ padding: "8px 6px" }}>Quora</th>
                  <th style={{ padding: "8px 6px" }}>URL check</th>
                  <th style={{ padding: "8px 6px" }}>Pts</th>
                  <th style={{ padding: "8px 6px", width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => {
                  const isSel = selected.has(s.id);
                  const isActing = acting === s.id;
                  return (
                    <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "10px 6px" }}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(s.id)} disabled={s.status !== "pending"} />
                      </td>
                      <td style={{ padding: "10px 6px" }}>
                        <div style={{ fontWeight: 600, color: "#F9FAFB" }}>{s.submitterUsername ?? s.submitterUserId.slice(0, 8)}</div>
                        <div style={{ fontSize: 11, color: "#4B5563" }}>{new Date(s.createdAtIso).toLocaleString()}</div>
                      </td>
                      <td style={{ padding: "10px 6px" }}>{s.displayName}</td>
                      <td style={{ padding: "10px 6px", maxWidth: 280 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {s.skills.map(sk => (
                            <span key={sk} style={{ padding: "1px 7px", borderRadius: 10, background: `${COLOR}20`, color: COLOR, fontSize: 11 }}>{sk}</span>
                          ))}
                          {s.proposedSkills.map(sk => (
                            <span key={sk} style={{ padding: "1px 7px", borderRadius: 10, background: "rgba(251,191,36,0.15)", color: "#FBBF24", fontSize: 11 }}>{sk} ✎</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "10px 6px" }}>
                        {s.quoraProfileUrl ? (
                          <a href={s.quoraProfileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#3B82F6", fontSize: 11 }}>open ↗</a>
                        ) : <span style={{ color: "#4B5563" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 6px", fontSize: 11, color: s.urlValidationResult === "dead" ? "#EF4444" : s.urlValidationResult === "valid" ? "#22C55E" : "#6B7280" }}>
                        {s.urlValidationResult ?? "—"}
                      </td>
                      <td style={{ padding: "10px 6px", color: COLOR, fontWeight: 700 }}>{s.pointsAwarded}</td>
                      <td style={{ padding: "10px 6px" }}>
                        {s.status === "pending" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button disabled={isActing} onClick={async () => { await reviewOne(s.id, "accept", null); await refresh(); }} style={{ padding: "4px 10px", borderRadius: 6, background: "#22C55E", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: isActing ? 0.5 : 1 }}>Accept</button>
                            <button disabled={isActing} onClick={async () => { const r = promptRejectReason(); if (r === null) return; await reviewOne(s.id, "reject", r); await refresh(); }} style={{ padding: "4px 10px", borderRadius: 6, background: "#EF4444", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: isActing ? 0.5 : 1 }}>Reject</button>
                            <button disabled={isActing} onClick={async () => { await reviewOne(s.id, "flag", null); await refresh(); }} style={{ padding: "4px 10px", borderRadius: 6, background: `${COLOR}30`, border: `1px solid ${COLOR}60`, color: COLOR, fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: isActing ? 0.5 : 1 }}>Flag</button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "#6B7280" }}>{s.reviewAction ?? s.status}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
