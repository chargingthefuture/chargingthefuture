"use client";

import { useCallback, useEffect, useState, type ChangeEventHandler } from "react";
import { PhoneCall } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getFoundationTokens, type FoundationTokens } from "./foundation-ui";
import { CallAlerts } from "./foundation-call-alerts";

type InstantCall = { enabled: boolean; rateCredits: number | null; intervalMinutes: number };

const DEFAULT_INTERVAL = 10;

const panelStyle = (t: FoundationTokens) => ({
  marginBottom: 20,
  padding: "20px 24px",
  borderRadius: 16,
  background: `linear-gradient(135deg,${t.ACCENT}15 0%,rgba(239,68,68,0.05) 100%)`,
  border: `1px solid ${t.ACCENT}20`,
} as const);

const inputStyle = (t: FoundationTokens) => ({
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  background: t.INPUT_BG,
  border: "1px solid rgba(255,255,255,0.12)",
  color: t.TITLE,
  fontSize: 14,
} as const);

// The on/off switch that lets a provider allow instant 1:1 calls. Kept as its own component so the
// per-state color/label ternaries live here and not in the parent panel.
function InstantCallToggle({ t, enabled, onToggle }: { t: FoundationTokens; enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "12px 16px", borderRadius: 12, cursor: "pointer", background: enabled ? `${t.ACCENT}12` : "rgba(255,255,255,0.02)", border: `1px solid ${enabled ? t.ACCENT + "40" : t.BORDER_STRONG}` }}
    >
      <span style={{ width: 40, height: 22, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", padding: 2, justifyContent: enabled ? "flex-end" : "flex-start", background: enabled ? t.ACCENT : "rgba(255,255,255,0.12)" }}>
        <span style={{ width: 18, height: 18, borderRadius: 999, background: enabled ? "#1a1205" : t.SUBTLE }} />
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: t.TITLE }}>Allow instant 1:1 calls</span>
      <span style={{ marginLeft: "auto", fontSize: 12, color: enabled ? t.ACCENT : t.MUTED }}>{enabled ? "On" : "Off"}</span>
    </button>
  );
}

// The rate and block-length inputs, shown only while instant calls are enabled. Returns null when
// disabled so the parent does not need an inline conditional.
function CallRateFields({
  t,
  enabled,
  rate,
  interval,
  onRateChange,
  onIntervalChange,
}: {
  t: FoundationTokens;
  enabled: boolean;
  rate: string;
  interval: number;
  onRateChange: ChangeEventHandler<HTMLInputElement>;
  onIntervalChange: ChangeEventHandler<HTMLInputElement>;
}) {
  if (!enabled) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#D1D5DB" }}>Credits per {interval} minutes</span>
        <input
          type="number"
          min={1}
          step={1}
          value={rate}
          onChange={onRateChange}
          placeholder="e.g. 5"
          style={inputStyle(t)}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#D1D5DB" }}>Block length (minutes)</span>
        <input
          type="number"
          min={5}
          max={60}
          step={1}
          value={interval}
          onChange={onIntervalChange}
          style={inputStyle(t)}
        />
      </label>
      <CallAlerts />
    </div>
  );
}

// The Save button plus the transient "Saved" confirmation. Owns the saving/saved ternaries.
function SaveRow({ t, saving, saved, onSave }: { t: FoundationTokens; saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        style={{ padding: "10px 18px", borderRadius: 10, cursor: saving ? "default" : "pointer", background: t.ACCENT, color: "#1a1205", fontSize: 14, fontWeight: 700, border: "none", opacity: saving ? 0.6 : 1 }}
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {saved ? <span style={{ fontSize: 13, color: t.ACCENT }}>Saved</span> : null}
    </div>
  );
}

// A provider opts in to take an immediate, paid, 1:1 call (Foundation "Connect now", issue #808).
// This panel only edits the provider's settings — the rate in ServiceCredits and the per-block
// interval. Ringing, the call itself, and any charge happen in later work, not here.
export function InstantCallSettings() {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  const [enabled, setEnabled] = useState(false);
  const [rate, setRate] = useState("");
  const [interval, setIntervalMinutes] = useState(DEFAULT_INTERVAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const apply = useCallback((data: InstantCall) => {
    setEnabled(data.enabled);
    setRate(data.rateCredits === null ? "" : String(data.rateCredits));
    setIntervalMinutes(data.intervalMinutes || DEFAULT_INTERVAL);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/foundation/provider/instant-call", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load your instant-call settings.");
      const data = (await res.json()) as { instantCall?: InstantCall };
      if (data.instantCall) apply(data.instantCall);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your instant-call settings.");
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const rateCredits = rate.trim() === "" ? null : Number(rate);
    try {
      const res = await fetch("/api/foundation/provider/instant-call", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ enabled, rateCredits, intervalMinutes: interval }),
      });
      const data = (await res.json().catch(() => ({}))) as { instantCall?: InstantCall; message?: string };
      if (!res.ok) throw new Error(data.message || "Could not save. Please try again.");
      if (data.instantCall) apply(data.instantCall);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [apply, enabled, interval, rate]);

  return (
    <div style={panelStyle(t)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <PhoneCall size={18} color={t.ACCENT} />
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE }}>Instant connection</div>
      </div>
      <div style={{ fontSize: 14, color: t.SUBTLE, marginBottom: 16 }}>
        Turn this on to let other members ring you for a live 1:1 call right now. They pay the rate you
        set for each block of time. You can turn it off anytime.
      </div>

      {error ? (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fecaca", fontSize: 13 }}>{error}</div>
      ) : null}

      {loading ? (
        <div style={{ padding: "16px 0", color: t.MUTED, fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <InstantCallToggle
            t={t}
            enabled={enabled}
            onToggle={() => { setEnabled((v) => !v); setSaved(false); }}
          />

          <CallRateFields
            t={t}
            enabled={enabled}
            rate={rate}
            interval={interval}
            onRateChange={(e) => { setRate(e.target.value); setSaved(false); }}
            onIntervalChange={(e) => { setIntervalMinutes(Number(e.target.value)); setSaved(false); }}
          />

          <SaveRow t={t} saving={saving} saved={saved} onSave={() => void save()} />
        </div>
      )}
    </div>
  );
}
