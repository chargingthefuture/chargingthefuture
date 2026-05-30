"use client";

import type { SkillsHuntRound, SkillsHuntSubmissionStatus } from "lib/skills-hunt/types";
import { COLOR, STATUS_OPTIONS } from "./sha-shared";

export function SkillsHuntAdminFilters({
  rounds,
  activeRoundId,
  onRound,
  statusFilter,
  onStatus,
}: {
  rounds: SkillsHuntRound[];
  activeRoundId: string | null;
  onRound: (id: string) => void;
  statusFilter: SkillsHuntSubmissionStatus;
  onStatus: (s: SkillsHuntSubmissionStatus) => void;
}) {
  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {rounds.map((r) => {
          const active = activeRoundId === r.id;
          return (
            <button key={r.id} type="button" onClick={() => onRound(r.id)}
              style={{ padding: "6px 14px", borderRadius: 20, background: active ? `${COLOR}25` : "rgba(255,255,255,0.04)", border: `1px solid ${active ? COLOR + "60" : "rgba(255,255,255,0.08)"}`, color: active ? COLOR : "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {r.name} <span style={{ opacity: 0.6 }}>· {r.status}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {STATUS_OPTIONS.map((s) => {
          const active = statusFilter === s.key;
          return (
            <button key={s.key} type="button" onClick={() => onStatus(s.key)}
              style={{ padding: "4px 12px", borderRadius: 20, background: active ? `${s.color}25` : "rgba(255,255,255,0.04)", border: `1px solid ${active ? s.color + "60" : "rgba(255,255,255,0.08)"}`, color: active ? s.color : "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {s.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function SkillsHuntAdminBulkBar({
  count,
  onAccept,
  onReject,
  onClear,
}: {
  count: number;
  onAccept: () => void;
  onReject: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 12, borderRadius: 10, background: `${COLOR}10`, border: `1px solid ${COLOR}30` }}>
      <span style={{ fontSize: 12, color: COLOR, fontWeight: 600 }}>{count} selected</span>
      <button type="button" onClick={onAccept} style={{ padding: "6px 14px", borderRadius: 8, background: "#22C55E", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Bulk accept</button>
      <button type="button" onClick={onReject} style={{ padding: "6px 14px", borderRadius: 8, background: "#EF4444", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Bulk reject</button>
      <button type="button" onClick={onClear} style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Clear</button>
    </div>
  );
}
