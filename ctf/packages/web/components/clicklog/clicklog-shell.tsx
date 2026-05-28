"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle, Bell, Clock, FileText,
  MapPin, Settings, Trash2,
} from "lucide-react";
import { MAX_NOTES_LENGTH } from "../../lib/clicklog/constants";
import type { ClicklogIncident } from "../../lib/clicklog/types";

// API: GET /api/clicklog  → { incidents[], count }
// API: POST /api/clicklog  → log incident
// API: DELETE /api/clicklog/:id  → delete incident

const BRAND = "#EF4444";
const bg = "#0F1117";
const surface = "#161B27";
const border = "#1E2A3A";
const textColor = "#F9FAFB";
const subtle = "#6B7280";

type Props = { userId: string };

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function getThisWeekCount(incidents: ClicklogIncident[]): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return incidents.filter((i) => new Date(i.created_at).getTime() > weekAgo).length;
}

function getThisMonthCount(incidents: ClicklogIncident[]): number {
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return incidents.filter((i) => new Date(i.created_at).getTime() > monthAgo).length;
}

function getWeeklyHeatmap(incidents: ClicklogIncident[]): boolean[] {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  return days.map((dayStart) =>
    incidents.some((i) => {
      const t = new Date(i.created_at).getTime();
      return t >= dayStart && t < dayStart + 86400000;
    })
  );
}

export function ClicklogShell({ userId: _userId }: Props) {
  const [incidents, setIncidents] = useState<ClicklogIncident[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [note, setNote] = useState("");
  const [geo, setGeo] = useState<{ latitude?: number; longitude?: number }>({});
  const [justLogged, setJustLogged] = useState(false);

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clicklog");
      if (!res.ok) throw new Error("Failed to fetch incidents");
      const data = await res.json();
      setIncidents(data.incidents ?? []);
      setCount(data.count ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncidents(); }, []);

  const handleLogClick = () => {
    setShowNoteForm(!showNoteForm);
    if (!showNoteForm && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeo({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => setGeo({}),
      );
    }
  };

  const submitIncident = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clicklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: { ...geo, notes: note || undefined } }),
      });
      if (!res.ok) throw new Error("Failed to log incident");
      setJustLogged(true);
      setTimeout(() => setJustLogged(false), 2000);
      setShowNoteForm(false);
      setNote("");
      setGeo({});
      await fetchIncidents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this incident?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clicklog/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchIncidents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const heatmap = getWeeklyHeatmap(incidents);
  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div style={{ display: "flex", height: "100vh", background: bg, fontFamily: "'Inter', system-ui, sans-serif", color: textColor, overflow: "hidden" }}>

      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${BRAND}25`, border: `1px solid ${BRAND}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <AlertTriangle size={20} color={BRAND} />
        </div>
        {[AlertTriangle, Clock, FileText].map((Icon, i) => (
          <button key={i} style={{ width: 44, height: 44, borderRadius: 12, background: i === 0 ? `${BRAND}20` : "transparent", border: i === 0 ? `1px solid ${BRAND}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: i === 0 ? BRAND : subtle }}>
            <Icon size={20} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: subtle }}><Bell size={18} /></button>
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: subtle }}><Settings size={18} /></button>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${BRAND}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: BRAND }}>S</div>
      </aside>

      {/* Left sidebar */}
      <aside style={{ width: 240, background: "#0D0F14", borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: subtle, textTransform: "uppercase", marginBottom: 4 }}>🚨 ClickLog</div>
          <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5 }}>Personal incident counter — private &amp; encrypted</div>
        </div>
        <div style={{ padding: "0 12px", flex: 1 }}>
          <div style={{ padding: "16px", borderRadius: 14, background: `${BRAND}08`, border: `1px solid ${BRAND}18`, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: subtle, marginBottom: 4 }}>Total Logged</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: BRAND }}>{count}</div>
            <div style={{ fontSize: 11, color: subtle, marginTop: 4 }}>incidents · all time</div>
          </div>
          <div style={{ padding: "12px", borderRadius: 12, background: surface, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 12, color: subtle, marginBottom: 8 }}>This week</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              {heatmap.map((hasIncident, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: hasIncident ? `${BRAND}25` : "rgba(255,255,255,0.04)", border: `1px solid ${hasIncident ? BRAND + "40" : border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: hasIncident ? BRAND : subtle }}>
                    {hasIncident ? "1" : ""}
                  </div>
                  <span style={{ fontSize: 8, color: subtle }}>{DAY_LABELS[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: 12, borderTop: `1px solid ${border}` }}>
          <div style={{ fontSize: 11, color: "#4B5563", lineHeight: 1.5 }}>🔒 All data is end-to-end encrypted. Only you can see your incidents.</div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <AlertTriangle size={18} color={BRAND} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: textColor }}>Incident Log</div>
            <div style={{ fontSize: 12, color: subtle }}>Personal safety tracking — {count} incidents total</div>
          </div>
          {error && <div style={{ fontSize: 12, color: BRAND }}>{error}</div>}
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "32px 48px" }}>

          {/* Big log button */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 40 }}>
            <button
              onClick={handleLogClick}
              disabled={loading}
              style={{ width: 160, height: 160, borderRadius: "50%", background: justLogged ? "#22C55E" : BRAND, border: `4px solid ${justLogged ? "#22C55E" : BRAND}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", boxShadow: `0 0 40px ${BRAND}30`, transition: "all 0.2s" }}
            >
              <AlertTriangle size={40} color="#fff" />
              <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{justLogged ? "Logged ✓" : "Log Incident"}</span>
            </button>
            <div style={{ fontSize: 12, color: subtle, textAlign: "center" }}>
              Tap to log an incident instantly.<br />Optionally add a note below.
            </div>

            {/* Note form */}
            {showNoteForm && (
              <div style={{ width: "100%", maxWidth: 480, padding: "16px", borderRadius: 14, background: surface, border: `1px solid ${BRAND}30` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: textColor, marginBottom: 8 }}>Add a note (optional)</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={MAX_NOTES_LENGTH}
                  placeholder="Describe what happened…"
                  style={{ width: "100%", padding: "10px 12px", background: bg, border: `1px solid ${border}`, borderRadius: 10, fontSize: 13, color: textColor, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, color: subtle, fontSize: 12, cursor: "pointer" }}
                    onClick={() => geo.latitude ? setGeo({}) : undefined}
                  >
                    <MapPin size={12} color={geo.latitude ? BRAND : subtle} />
                    {geo.latitude ? "Location added" : "Add location"}
                  </button>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => { setShowNoteForm(false); setNote(""); setGeo({}); }} style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, color: subtle, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                  <button onClick={submitIncident} disabled={loading} style={{ padding: "7px 18px", borderRadius: 8, background: BRAND, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Submit</button>
                </div>
              </div>
            )}
          </div>

          {/* Incident history */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: textColor, marginBottom: 14 }}>Recent Incidents</div>
            {incidents.length === 0 ? (
              <div style={{ fontSize: 13, color: subtle, textAlign: "center", padding: "32px 0" }}>No incidents logged yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {incidents.map((incident) => (
                  <div key={incident.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 12, background: surface, border: `1px solid ${border}` }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${BRAND}12`, border: `1px solid ${BRAND}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <AlertTriangle size={14} color={BRAND} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: subtle, marginBottom: 3 }}>{formatRelativeTime(incident.created_at)}</div>
                      {incident.metadata.notes && (
                        <div style={{ fontSize: 13, color: textColor, lineHeight: 1.5, marginBottom: 4 }}>{incident.metadata.notes}</div>
                      )}
                      {(incident.metadata.latitude || incident.metadata.longitude) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: subtle }}>
                          <MapPin size={10} color={subtle} /> Location recorded
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleDelete(incident.id)} disabled={loading} style={{ width: 28, height: 28, borderRadius: 6, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: subtle, flexShrink: 0 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right rail */}
      <aside style={{ width: 280, borderLeft: `1px solid ${border}`, background: "#0D0F14", padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Stats</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "This week", value: String(getThisWeekCount(incidents)), color: BRAND },
            { label: "This month", value: String(getThisMonthCount(incidents)), color: "#F97316" },
            { label: "With notes", value: String(incidents.filter((i) => i.metadata.notes).length), color: "#9CA3AF" },
            { label: "With location", value: String(incidents.filter((i) => i.metadata.latitude).length), color: "#06B6D4" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: "10px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${border}`, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 10, color: subtle, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px", borderRadius: 12, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: BRAND, marginBottom: 6 }}>Safety reminder</div>
          <div style={{ fontSize: 11, color: subtle, lineHeight: 1.6 }}>
            ClickLog is for personal tracking only. In an emergency, always contact local emergency services first.
          </div>
        </div>
      </aside>
    </div>
  );
}
