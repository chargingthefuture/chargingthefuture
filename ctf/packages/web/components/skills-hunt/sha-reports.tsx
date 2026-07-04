"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  SkillsHuntSubmissionReport,
  SkillsHuntSubmissionReportStatus,
} from "lib/skills-hunt/types";
import { feedAuthorHandle } from "lib/feed/author-handle";
import { COLOR } from "./sha-shared";

const STATUS_FILTERS: Array<{ key: SkillsHuntSubmissionReportStatus; label: string; color: string }> = [
  { key: "open",      label: "Open",      color: "#F59E0B" },
  { key: "dismissed", label: "Dismissed", color: "#6B7280" },
  { key: "archived",  label: "Archived",  color: COLOR },
  { key: "removed",   label: "Removed",   color: "#EF4444" },
];

type Resolution = "dismissed" | "archived" | "removed";
const RESOLUTIONS: Array<{ status: Resolution; label: string; color: string }> = [
  { status: "dismissed", label: "Dismiss", color: "#6B7280" },
  { status: "archived",  label: "Archive", color: COLOR },
  { status: "removed",   label: "Remove",  color: "#EF4444" },
];

function ReportCard({ report, onResolve }: { report: SkillsHuntSubmissionReport; onResolve: (id: string, status: Resolution) => void }) {
  const reporter = feedAuthorHandle(report.reporterUsername, report.reporterUserId);
  const target = report.submissionId
    ? `submission ${report.submissionId}`
    : report.directoryProfileId
      ? `directory ${report.directoryProfileId}`
      : "—";
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontWeight: 700, color: "#F9FAFB" }}>{report.reason}</div>
      {report.details && <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>{report.details}</div>}
      <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
        {reporter} · {target} · {report.status} · {new Date(report.createdAtIso).toLocaleString()}
      </div>
      {report.status === "open" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {RESOLUTIONS.map((r) => (
            <button key={r.status} type="button" onClick={() => onResolve(report.id, r.status)}
              style={{ padding: "5px 12px", borderRadius: 8, background: `${r.color}20`, border: `1px solid ${r.color}50`, color: r.color, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SkillsHuntAdminReports() {
  const [status, setStatus] = useState<SkillsHuntSubmissionReportStatus>("open");
  const [reports, setReports] = useState<SkillsHuntSubmissionReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/skills-hunt/admin/reports?status=${status}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Unable to load reports.");
      }
      const data = (await res.json()) as { items: SkillsHuntSubmissionReport[] };
      setReports(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function resolve(reportId: string, next: Resolution) {
    if (!window.confirm(`Mark this report as "${next}"?`)) return;
    const notes = window.prompt("Resolution notes (optional)");
    try {
      const res = await fetch(`/api/skills-hunt/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ status: next, resolutionNotes: notes || null }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Unable to resolve report.");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to resolve report.");
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((s) => {
          const active = status === s.key;
          return (
            <button key={s.key} type="button" onClick={() => setStatus(s.key)}
              style={{ padding: "4px 12px", borderRadius: 20, background: active ? `${s.color}25` : "rgba(255,255,255,0.04)", border: `1px solid ${active ? s.color + "60" : "rgba(255,255,255,0.08)"}`, color: active ? s.color : "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {s.label}
            </button>
          );
        })}
      </div>
      {error && <div style={{ marginBottom: 12, color: "#EF4444", fontSize: 13 }}>{error}</div>}
      {loading ? (
        <div style={{ color: "#6B7280", fontSize: 13 }}>Loading reports…</div>
      ) : reports.length === 0 ? (
        <div style={{ color: "#6B7280", fontSize: 13 }}>No reports in this status.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {reports.map((r) => <ReportCard key={r.id} report={r} onResolve={resolve} />)}
        </div>
      )}
    </div>
  );
}
