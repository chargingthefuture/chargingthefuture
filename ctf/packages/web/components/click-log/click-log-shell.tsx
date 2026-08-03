"use client";

import { useEffect, useState } from "react";
import { BackChevronButton } from "@/lib/nav/back-history";
import type { ClickLogIncident } from "../../lib/click-log/types";
import { useTheme } from "@/hooks/useTheme";
import { deriveClickLogStats, getClickLogTokens } from "./click-log-shared";
import { ClickLogLogPanel } from "./click-log-log-panel";
import { ClickLogIncidentList } from "./click-log-incident-list";
import { ClickLogEmptyState } from "./click-log-empty-state";
import { ClickLogLoading } from "./click-log-loading";
import { AlertTriangle } from "lucide-react";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";
import { useOwnerShare } from "./click-log-use-owner-share";

type Geo = { latitude?: number; longitude?: number };

export function ClickLogShell() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<ClickLogIncident[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  // Optional tags for the incident being logged ("" = untagged). Slugs from lib/click-log/tags.
  const [problemTag, setProblemTag] = useState("");
  const [schemeTag, setSchemeTag] = useState("");
  const [geo, setGeo] = useState<Geo>({});
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "error">("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);
  const { theme } = useTheme();
  const t = getClickLogTokens(theme);

  async function fetchIncidents(initial = false): Promise<void> {
    if (initial) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/click-log");
      if (!res.ok) throw new Error("Failed to fetch incidents");
      const data = (await res.json()) as { incidents: ClickLogIncident[]; count: number };
      setIncidents(data.incidents);
      setTotalCount(typeof data.count === "number" ? data.count : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch incidents");
    } finally {
      if (initial) setLoading(false);
    }
  }

  // Owner-share consent (global default + per-incident choice) — see click-log-use-owner-share.
  const share = useOwnerShare({ onError: setError, onBusy: setBusy, refresh: fetchIncidents });

  useEffect(() => {
    void fetchIncidents(true);
  }, []);

  function flashLogged(): void {
    setLogged(true);
    setTimeout(() => setLogged(false), 2000);
  }

  function addLocation(): void {
    if (!navigator.geolocation) {
      setGeoError("This browser can't access location.");
      setGeoStatus("error");
      return;
    }
    setGeoStatus("locating");
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoStatus("idle");
        setGeoError(null);
      },
      (err) => {
        setGeo({});
        // Surface the specific reason. On iPhone, location commonly fails even when
        // Safari's per-site toggle says Allow — the OS-level Location Services for
        // Safari must also be on — so name that path for a denied permission.
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked. On iPhone: Settings → Privacy & Security → Location Services → turn it on and set Safari Websites to “While Using the App”, then reload and try again."
            : err.code === err.TIMEOUT
              ? "Location timed out — try again."
              : "Your location is unavailable right now — try again, ideally with Wi-Fi on.";
        setGeoError(message);
        setGeoStatus("error");
      },
      // High accuracy (GPS) is slow and flaky on mobile and an incident log does not
      // need pinpoint precision, so prefer the faster network fix; keep a 10s timeout.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function postIncident(metadata: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/click-log", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          metadata,
          sharedWithOwner: share.formShare,
          // Omit an unpicked tag entirely — the API treats absent as untagged.
          ...(problemTag ? { problemTag } : {}),
          ...(schemeTag ? { schemeTag } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to log incident");
      }
      setShowForm(false);
      setNote("");
      setProblemTag("");
      setSchemeTag("");
      setGeo({});
      setGeoStatus("idle");
      setGeoError(null);
      share.setFormShare(share.shareDefault);
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
      const res = await fetch(`/api/click-log/${id}`, { method: "DELETE", headers: { "x-ctf-csrf": "1" } });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to delete incident");
      }
      await fetchIncidents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete incident");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <ClickLogLoading />;

  if (incidents.length === 0 && !showForm) {
    return <ClickLogEmptyState onLog={() => setShowForm(true)} />;
  }

  const stats = deriveClickLogStats(incidents);
  // The GET response is capped at 50 incidents but returns the true DB `count`. Use
  // that for the headline total so a user with >50 incidents sees the real number;
  // fall back to the loaded array length if `count` is unavailable.
  const displayTotal = totalCount ?? stats.total;

  const content = (
    <>
      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fecaca", fontSize: 13 }}>
          {error}
        </div>
      )}

      <ClickLogLogPanel
        logged={logged}
        showForm={showForm}
        note={note}
        submitting={busy}
        locationAdded={typeof geo.latitude === "number"}
        geoStatus={geoStatus}
        geoError={geoError}
        shareWithOwner={share.formShare}
        problemTag={problemTag}
        schemeTag={schemeTag}
        onShareChange={share.setFormShare}
        onProblemTagChange={setProblemTag}
        onSchemeTagChange={setSchemeTag}
        onToggleForm={() => setShowForm((s) => !s)}
        onNoteChange={setNote}
        onAddLocation={addLocation}
        onSubmit={() => void postIncident({ ...geo, notes: note })}
        onCancel={() => { setShowForm(false); setNote(""); setProblemTag(""); setSchemeTag(""); setGeo({}); setGeoStatus("idle"); setGeoError(null); share.setFormShare(share.shareDefault); }}
      />

      {/* Global share default. Opt-in and member-controlled; a new incident starts from this
          setting and can be overridden per incident in the log form or the list below. */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, padding: "10px 14px", borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, fontSize: 12, color: t.MUTED, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={share.shareDefault}
          onChange={(e) => void share.setDefault(e.target.checked)}
          style={{ accentColor: t.ACCENT }}
        />
        Share new incidents with the owner by default (only coarse trend data — never your notes or exact location)
      </label>

      {incidents.length > 0 && (
        <ClickLogIncidentList
          incidents={incidents}
          onDelete={(id) => void handleDelete(id)}
          onToggleShare={(id, next) => void share.toggleIncident(id, next)}
        />
      )}
    </>
  );

  return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TITLE }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <BackChevronButton accent={t.ACCENT} />
            <AlertTriangle size={18} color={t.ACCENT} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Title and subtitle truncate so the trailing controls stay on screen */}
              <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Incident Log</div>
              <div style={{ fontSize: 11, color: t.MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayTotal} incidents total</div>
            </div>
            <RefreshButton onRefresh={() => fetchIncidents()} title="Refresh incidents" />
            <MobileTopActions />
          </div>
        </div>
        <div style={{ padding: 16 }}>{content}</div>
      </div>
    );
}
