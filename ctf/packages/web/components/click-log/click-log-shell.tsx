"use client";

import { useEffect, useState } from "react";
import { BackChevronButton } from "@/lib/nav/back-history";
import type { ClickLogIncident } from "../../lib/click-log/types";
import { NOT_LISTED_SCHEME_SLUG } from "../../lib/click-log/tags";
import { useTheme } from "@/hooks/useTheme";
import { deriveClickLogStats, getClickLogTokens } from "./click-log-shared";
import { ClickLogLogPanel } from "./click-log-log-panel";
import { ClickLogIncidentList } from "./click-log-incident-list";
import { ClickLogEmptyState } from "./click-log-empty-state";
import { ClickLogLoading } from "./click-log-loading";
import { AlertTriangle } from "lucide-react";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { RefreshButton } from "@/components/shared/refresh-button";
import { useOwnerShare } from "./click-log-use-owner-share";
import { useIncidentEdit } from "./click-log-use-incident-edit";
import { SHARE_DEFAULT_LABEL } from "../../lib/click-log/share-copy";

type Geo = { latitude?: number; longitude?: number };

// The geolocation failure copy. On iPhone, location commonly fails even when Safari's per-site
// toggle says Allow — the OS-level Location Services for Safari must also be on — so name that
// path for a denied permission. Module-level to keep the shell under the function-length limit.
function geoErrorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) {
    return "Location is blocked. On iPhone: Settings → Privacy & Security → Location Services → turn it on and set Safari Websites to “While Using the App”, then reload and try again.";
  }
  if (err.code === err.TIMEOUT) {
    return "Location timed out — try again.";
  }
  return "Your location is unavailable right now — try again, ideally with Wi-Fi on.";
}

// Throw the server's structured { error } message (or the fallback) on a failed response.
// Module-level to keep the shell under the function-length limit.
async function throwIfNotOk(res: Response, fallback: string): Promise<void> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? fallback);
  }
}

// Build the create-incident request body. Unpicked tags are omitted entirely (the API treats
// absent as untagged), and the suggestion fields ride along only with the "Not listed" scheme
// (the API rejects them otherwise). A tagged incident always shares its trend data (owner
// decision, 2026-08-18) — the form locks the share checkbox on, and this sends the matching
// true so the server (which rejects tagged-but-unshared) accepts it. Module-level so
// postIncident stays under the complexity limit.
function buildCreateBody(args: {
  metadata: Record<string, unknown>;
  sharedWithOwner: boolean;
  problemTags: string[];
  schemeTags: string[];
  schemeSuggestion: string;
  schemeQuoraUrl: string;
}): Record<string, unknown> {
  const notListed = args.schemeTags.includes(NOT_LISTED_SCHEME_SLUG);
  const tagged = args.problemTags.length > 0 || args.schemeTags.length > 0;
  return {
    metadata: args.metadata,
    sharedWithOwner: tagged || args.sharedWithOwner,
    ...(args.problemTags.length > 0 ? { problemTags: args.problemTags } : {}),
    ...(args.schemeTags.length > 0 ? { schemeTags: args.schemeTags } : {}),
    ...(notListed && args.schemeSuggestion.trim() ? { schemeSuggestion: args.schemeSuggestion.trim() } : {}),
    ...(notListed && args.schemeQuoraUrl.trim() ? { schemeQuoraUrl: args.schemeQuoraUrl.trim() } : {}),
  };
}

// Global share default. Opt-in and member-controlled; a new incident starts from this setting
// and can be overridden per incident in the log form or the history list. Module-level to keep
// ClickLogShell under the function-length limit.
function ShareDefaultToggle({
  checked,
  tokens,
  onChange,
}: {
  checked: boolean;
  tokens: ReturnType<typeof getClickLogTokens>;
  onChange: (next: boolean) => void;
}) {
  const t = tokens;
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, padding: "10px 14px", borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, fontSize: 12, color: t.MUTED, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: t.ACCENT }}
      />
      {SHARE_DEFAULT_LABEL}
    </label>
  );
}

// The screen header: name, running total, and the row of controls. Module-level to keep
// ClickLogShell under the function-length limit. The title is the plugin's registry name, so a
// member who tapped ClickLog lands on a screen with the same name on it.
function ClickLogHeader({
  tokens,
  total,
  isAdmin,
  onRefresh,
}: {
  tokens: ReturnType<typeof getClickLogTokens>;
  total: number;
  isAdmin?: boolean;
  onRefresh: () => void;
}) {
  const t = tokens;
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
      {/* flexWrap: with the admin shortcut in the row, the plugin actions plus the three global
          ones overflow a 390px phone. Wrapping reflows instead of clipping the last control off
          the right edge; on a wider viewport it still renders as one line. */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 6, gap: 10, padding: "10px 14px" }}>
        <BackChevronButton accent={t.ACCENT} />
        <AlertTriangle size={18} color={t.ACCENT} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title and subtitle truncate so the trailing controls stay on screen */}
          <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>ClickLog</div>
          <div style={{ fontSize: 11, color: t.MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{total} incidents total</div>
        </div>
        {/* Counterpart of the "Member view" pill on the trends dashboard, so the pair can be
            crossed both ways. Renders nothing for a non-admin. */}
        <PluginAdminButton href="/admin/click-log" isAdmin={isAdmin} accent={t.ACCENT} />
        <RefreshButton onRefresh={onRefresh} title="Refresh incidents" />
        <MobileTopActions />
      </div>
    </div>
  );
}

// `isAdmin` only decides whether the header shows the shortcut to the trends screen; every
// admin-only figure comes from an admin-gated API, so a wrong value here reveals nothing.
export function ClickLogShell({ isAdmin }: { isAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<ClickLogIncident[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  // Optional tags for the incident being logged ([] = untagged). Slugs from lib/click-log/tags.
  const [problemTags, setProblemTags] = useState<string[]>([]);
  const [schemeTags, setSchemeTags] = useState<string[]>([]);
  // "Not listed" scheme-suggestion state. canSuggestScheme comes from GET /api/click-log
  // (Weavers of the Commons badge holders only); when false the option is hidden entirely.
  const [canSuggestScheme, setCanSuggestScheme] = useState(false);
  const [schemeSuggestion, setSchemeSuggestion] = useState("");
  const [schemeQuoraUrl, setSchemeQuoraUrl] = useState("");
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
      const data = (await res.json()) as {
        incidents: ClickLogIncident[];
        count: number;
        canSuggestScheme?: boolean;
      };
      setIncidents(data.incidents);
      setTotalCount(typeof data.count === "number" ? data.count : null);
      setCanSuggestScheme(data.canSuggestScheme === true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch incidents");
    } finally {
      if (initial) setLoading(false);
    }
  }

  // Owner-share consent (global default + per-incident choice) — see click-log-use-owner-share.
  const share = useOwnerShare({ onError: setError, onBusy: setBusy, refresh: fetchIncidents });
  // Inline per-incident edit (note + tags; date and location immutable) — see
  // click-log-use-incident-edit.
  const edit = useIncidentEdit({ onError: setError, onBusy: setBusy, refresh: fetchIncidents });

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
        setGeoError(geoErrorMessage(err));
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
        body: JSON.stringify(
          buildCreateBody({
            metadata,
            sharedWithOwner: share.formShare,
            problemTags,
            schemeTags,
            schemeSuggestion,
            schemeQuoraUrl,
          }),
        ),
      });
      await throwIfNotOk(res, "Failed to log incident");
      setShowForm(false);
      setNote("");
      setProblemTags([]);
      setSchemeTags([]);
      setSchemeSuggestion("");
      setSchemeQuoraUrl("");
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
      await throwIfNotOk(res, "Failed to delete incident");
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
        problemTags={problemTags}
        schemeTags={schemeTags}
        schemeSuggestion={{
          canSuggestScheme,
          suggestion: schemeSuggestion,
          quoraUrl: schemeQuoraUrl,
          onSuggestionChange: setSchemeSuggestion,
          onQuoraUrlChange: setSchemeQuoraUrl,
        }}
        onShareChange={share.setFormShare}
        onProblemTagsChange={setProblemTags}
        onSchemeTagsChange={setSchemeTags}
        onToggleForm={() => setShowForm((s) => !s)}
        onNoteChange={setNote}
        onAddLocation={addLocation}
        onSubmit={() => void postIncident({ ...geo, notes: note })}
        onCancel={() => { setShowForm(false); setNote(""); setProblemTags([]); setSchemeTags([]); setSchemeSuggestion(""); setSchemeQuoraUrl(""); setGeo({}); setGeoStatus("idle"); setGeoError(null); share.setFormShare(share.shareDefault); }}
      />

      <ShareDefaultToggle
        checked={share.shareDefault}
        tokens={t}
        onChange={(next) => void share.setDefault(next)}
      />

      {incidents.length > 0 && (
        <ClickLogIncidentList
          incidents={incidents}
          editingId={edit.editingId}
          editBusy={busy}
          onDelete={(id) => void handleDelete(id)}
          onToggleShare={(id, next) => void share.toggleIncident(id, next)}
          onEdit={edit.start}
          onSaveEdit={(id, fields) => void edit.save(id, fields)}
          onCancelEdit={edit.cancel}
        />
      )}
    </>
  );

  return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TITLE }}>
        <ClickLogHeader
          tokens={t}
          total={displayTotal}
          isAdmin={isAdmin}
          onRefresh={() => fetchIncidents()}
        />
        <div style={{ padding: 16 }}>{content}</div>
      </div>
    );
}
