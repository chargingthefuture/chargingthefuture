"use client";

import { useEffect, useState } from "react";
import type { ClicklogIncident } from "../../lib/clicklog/types";
import { BG, BORDER, BRAND, SUBTLE, TEXT, deriveClicklogStats } from "./clicklog-shared";
import { ClicklogIconRail } from "./clicklog-icon-rail";
import { ClicklogSidebar } from "./clicklog-sidebar";
import { ClicklogRightRail } from "./clicklog-right-rail";
import { ClicklogLogPanel } from "./clicklog-log-panel";
import { ClicklogIncidentList } from "./clicklog-incident-list";
import { ClicklogEmptyState } from "./clicklog-empty-state";
import { ClicklogLoading } from "./clicklog-loading";
import { AlertTriangle } from "lucide-react";

type Geo = { latitude?: number; longitude?: number };

export function ClicklogShell() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<ClicklogIncident[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [geo, setGeo] = useState<Geo>({});
  const [logged, setLogged] = useState(false);

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
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setGeo({}),
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

  return (
    <div style={{ display: "flex", height: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: TEXT, overflow: "hidden" }}>
      <ClicklogIconRail />
      <ClicklogSidebar total={stats.total} weekdayCounts={stats.weekdayCounts} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <AlertTriangle size={18} color={BRAND} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Incident Log</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Personal safety tracking — {stats.total} incidents total</div>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "32px 48px" }}>
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
            onToggleForm={() => setShowForm((s) => !s)}
            onNoteChange={setNote}
            onAddLocation={addLocation}
            onSubmit={() => void postIncident({ ...geo, notes: note })}
            onCancel={() => { setShowForm(false); setNote(""); setGeo({}); }}
          />

          {incidents.length > 0 && (
            <ClicklogIncidentList incidents={incidents} onDelete={(id) => void handleDelete(id)} />
          )}
        </div>
      </div>

      <ClicklogRightRail stats={stats} loading={busy} onQuickLog={() => void postIncident({})} />
    </div>
  );
}
