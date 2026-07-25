"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getFoundationTokens, type FoundationTokens } from "./foundation-ui";

const DEFAULT_MAX = 200;

const panelStyle = (t: FoundationTokens) => ({
  marginBottom: 20,
  padding: "20px 24px",
  borderRadius: 16,
  background: `linear-gradient(135deg,${t.ACCENT}15 0%,rgba(239,68,68,0.05) 100%)`,
  border: `1px solid ${t.ACCENT}20`,
} as const);

// A provider writes a short blurb (one or two sentences) shown on their Foundation listing before a
// member requests a quote. This is their own plain "here's what I offer" line — separate from the
// Directory headline/bio and the offered-skill chips. Saving persists it; a blank value clears it.
export function ProviderDescriptionSettings() {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  const [value, setValue] = useState("");
  const [maxLength, setMaxLength] = useState(DEFAULT_MAX);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/foundation/provider/description", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load your listing description.");
      const data = (await res.json()) as { shortDescription?: string | null; maxLength?: number };
      setValue(data.shortDescription ?? "");
      if (typeof data.maxLength === "number") setMaxLength(data.maxLength);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your listing description.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/foundation/provider/description", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ shortDescription: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { shortDescription?: string | null; message?: string };
      if (!res.ok) throw new Error(data.message || "Could not save. Please try again.");
      setValue(data.shortDescription ?? "");
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [value]);

  const remaining = maxLength - value.length;
  const overLimit = remaining < 0;

  return (
    <div style={panelStyle(t)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <MessageSquareText size={18} color={t.ACCENT} />
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE }}>Your listing blurb</div>
      </div>
      <div style={{ fontSize: 14, color: t.SUBTLE, marginBottom: 16 }}>
        One or two sentences shown on your Foundation listing before someone requests a quote. Say in
        plain words what you offer. Leave it empty to show nothing.
      </div>

      {error ? (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fecaca", fontSize: 13 }}>{error}</div>
      ) : null}

      {loading ? (
        <div style={{ padding: "16px 0", color: t.MUTED, fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#D1D5DB" }}>Short description</span>
            <textarea
              value={value}
              onChange={(e) => { setValue(e.target.value); setSaved(false); }}
              rows={3}
              placeholder="e.g. I help with resume reviews and mock interviews for tech roles."
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: t.INPUT_BG, border: `1px solid ${overLimit ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.12)"}`, color: t.TITLE, fontSize: 14, resize: "vertical", fontFamily: "inherit" }}
            />
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              disabled={saving || overLimit}
              onClick={() => void save()}
              style={{ padding: "10px 18px", borderRadius: 10, cursor: saving || overLimit ? "default" : "pointer", background: t.ACCENT, color: "#1a1205", fontSize: 14, fontWeight: 700, border: "none", opacity: saving || overLimit ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved ? <span style={{ fontSize: 13, color: t.ACCENT }}>Saved</span> : null}
            <span style={{ marginLeft: "auto", fontSize: 12, color: overLimit ? "#fca5a5" : t.MUTED }}>{remaining} left</span>
          </div>
        </div>
      )}
    </div>
  );
}
