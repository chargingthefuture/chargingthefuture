"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClicklogIncident } from "../../lib/clicklog/types";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useTheme } from "@/hooks/useTheme";
import { deriveClicklogStats, getClicklogTokens } from "./clicklog-shared";
import { ClicklogIconRail } from "./clicklog-icon-rail";
import { ClicklogSidebar } from "./clicklog-sidebar";
import { ClicklogRightRail } from "./clicklog-right-rail";
import { ClicklogLogPanel } from "./clicklog-log-panel";
import { ClicklogIncidentList } from "./clicklog-incident-list";
import { ClicklogEmptyState } from "./clicklog-empty-state";
import { ClicklogLoading } from "./clicklog-loading";
import { AlertTriangle, ChevronLeft } from "lucide-react";

type Geo = { latitude?: number; longitude?: number };

export function ClicklogShell() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<ClicklogIncident[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [geo, setGeo] = useState<Geo>({});
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "error">("idle");
  const [logged, setLogged] = useState(false);
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getClicklogTokens(theme);

  async function fetchIncidents(initial = false): Promise<void> {
    if (initial) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clicklog");
      if (!res.ok) throw new Error("Failed to fetch incidents");
      const data = (await res.json()) as { incidents: ClicklogIncident[]; count: number };
      setIncidents(data.incidents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch incidents");
    } finally {
      if (initial) setLoading(false);
    }
  }

  useEffect(() => {
    void fetchIncidents(true);
  }, []);

  function flashLogged(): void {
    setLogged(true);
    setTimeout(() => setLogged(false), 2000);
  }

  function addLocation(): void {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoStatus("idle");
      },
      () => {
        setGeo({});
        setGeoStatus("error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function postIncident(metadata: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/clicklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata }),
      });
      if (!res.ok) throw new Error("Failed to log incident");
      setShowForm(false);
      setNote("");
      setGeo({});
      setGeoStatus("idle");
      flashLogged();
      await fetchIncidents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to log incident");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm("Are you sure you want to delete this incident?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clicklog/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete incident");
      await fetchIncidents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete incident");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <ClicklogLoading />;

  if (incidents.length === 0 && !showForm) {
    return <ClicklogEmptyState onLog={() => setShowForm(true)} />;
  }

  const stats = deriveClicklogStats(incidents);

  const content = (
    <>
      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fecaca", fontSize: 13 }}>
          {error}
        </div>
      )}

      <ClicklogLogPanel
        logged={logged}
        showForm={showForm}
        note={note}
        submitting={busy}
        locationAdded={typeof geo.latitude === "number"}
        geoStatus={geoStatus}
        onToggleForm={() => setShowForm((s) => !s)}
        onNoteChange={setNote}
        onAddLocation={addLocation}
        onSubmit={() => void postIncident({ ...geo, notes: note })}
        onCancel={() => { setShowForm(false); setNote(""); setGeo({}); setGeoStatus("idle"); }}
      />

      {incidents.length > 0 && (
        <ClicklogIncidentList incidents={incidents} onDelete={(id) => void handleDelete(id)} />
      )}
    </>
  );

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TITLE }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}40`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <AlertTriangle size={18} color={t.ACCENT} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>Incident Log</div>
              <div style={{ fontSize: 11, color: t.MUTED }}>{stats.total} incidents total</div>
            </div>
          </div>
        </div>
        <div style={{ padding: 16 }}>{content}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TITLE, overflow: "hidden" }}>
      <ClicklogIconRail />
      <ClicklogSidebar total={stats.total} weekdayCounts={stats.weekdayCounts} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER_SOLID}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: t.HEADER, flexShrink: 0 }}>
          <AlertTriangle size={18} color={t.ACCENT} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.TITLE }}>Incident Log</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Personal safety tracking — {stats.total} incidents total</div>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "32px 48px" }}>
          {content}
        </div>
      </div>

      <ClicklogRightRail stats={stats} loading={busy} onQuickLog={() => void postIncident({})} />
    </div>
  );
}
