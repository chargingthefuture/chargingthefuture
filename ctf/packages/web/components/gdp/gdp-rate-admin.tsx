"use client";

// Admin-only currency USD-rate management for the aggregate GDP estimate (issue #312 P2).
// These factors exist SOLELY to normalize multi-currency volume into one USD-denominated
// GDP estimate (a morale/transparency metric). LEGAL HARD LINE: never rendered as a
// per-wallet / per-price "ServiceCredits = fiat" equivalence or a redemption value.
// Mirrors design/.../survivor-hub/GDPRateAdmin.tsx + MobileGDPRateAdmin.tsx.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, ShieldCheck, Clock, CheckCircle, Edit2, AlertTriangle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useTheme } from "@/hooks/useTheme";
import { getGdpTokens } from "./gdp-shared";

type RateFactor = { usdRate: number; asOf: string; source: string };

type CurrencyEntry = {
  code: string;
  label: string;
  symbol: string | null;
  isServiceCredits: boolean;
  decimalPlaces: number;
  sortOrder: number;
  current: RateFactor | null;
  history: RateFactor[];
};

// United States Dollar is the baseline; its factor is fixed at 1 and not revised.
function isFixedBaseline(c: CurrencyEntry): boolean {
  return c.code === "USD";
}

function fmtFactor(c: CurrencyEntry): string {
  if (isFixedBaseline(c)) return "—";
  if (!c.current) return "Not set";
  const r = c.current.usdRate;
  const d = r < 0.001 ? 5 : r < 0.1 ? 4 : 3;
  return `$${r.toFixed(d)}${c.symbol ? ` / ${c.symbol}` : ""}`;
}

function symbolGlyph(c: CurrencyEntry): string {
  return c.symbol ?? c.code;
}

const DISCLAIMER =
  "These factors exist solely to normalize multi-currency activity into one aggregate GDP estimate — a morale and transparency metric. They are never a redemption rate, per-wallet conversion, or the price of ServiceCredits. Revising adds a new dated row; all prior values are preserved as history.";

export default function GdpRateAdmin() {
  const { theme } = useTheme();
  const t = getGdpTokens(theme);
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyEntry[]>([]);

  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [newRate, setNewRate] = useState("");
  const [newSource, setNewSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gdp/admin/currency-rates", { signal });
      if (!res.ok) throw new Error("Failed to load currency factors");
      const data = (await res.json()) as { ok: boolean; currencies?: CurrencyEntry[] };
      if (!signal?.aborted) setCurrencies(data.currencies ?? []);
    } catch (e: unknown) {
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : "Failed to load currency factors.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const editing = useMemo(
    () => currencies.find((c) => c.code === editingCode) ?? null,
    [currencies, editingCode],
  );

  const openEdit = (c: CurrencyEntry) => {
    setEditingCode(c.code);
    setNewRate(c.current ? String(c.current.usdRate) : "");
    setNewSource("");
    setSaved(false);
    setSaveError(null);
  };

  const closeEdit = () => {
    setEditingCode(null);
    setSaved(false);
    setSaveError(null);
  };

  const canSave = newRate.trim() !== "" && newSource.trim() !== "" && !saving;

  const save = async () => {
    if (!editing || !canSave) return;
    const rateNum = Number(newRate);
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      setSaveError("Factor must be a number greater than zero.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/gdp/admin/currency-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ currencyCode: editing.code, usdRate: rateNum, source: newSource.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "Failed to save the new factor.");
      }
      setSaved(true);
      await load();
      setTimeout(() => {
        setSaved(false);
        setEditingCode(null);
      }, 2200);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save the new factor.");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = currencies.filter((c) => !isFixedBaseline(c)).length;

  // ── Shared sub-blocks ──────────────────────────────────────────────────────
  function Disclaimer() {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 16px", borderRadius: 12, background: "rgba(234,179,8,0.05)", border: "1px solid rgba(234,179,8,0.18)", marginBottom: 20 }}>
        <AlertTriangle size={14} color="#EAB308" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: t.SUBTLE, lineHeight: 1.65 }}>{DISCLAIMER}</div>
      </div>
    );
  }

  function ReviseForm() {
    if (!editing) return null;
    if (saved) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "28px 0", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle size={28} color={t.ACCENT} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Factor saved</div>
          <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>
            New row added with today&apos;s date.<br />Prior values preserved as history.
          </div>
        </div>
      );
    }
    return (
      <>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>Revise — {editing.label}</div>
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 20 }}>Creates a new dated row. History is preserved.</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE, display: "block", marginBottom: 6 }}>New USD factor *</label>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 13px", background: t.INPUT_BG, border: `1px solid ${newRate ? t.ACCENT + "50" : t.BORDER_SOLID}`, borderRadius: 10, gap: 8 }}>
            <span style={{ fontSize: 13, color: t.MUTED }}>$</span>
            <input value={newRate} onChange={(e) => setNewRate(e.target.value)} inputMode="decimal" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: t.TITLE }} placeholder="0.00000" />
            {editing.symbol ? <span style={{ fontSize: 12, color: t.MUTED }}>/ {editing.symbol}</span> : null}
          </div>
          <div style={{ fontSize: 10.5, color: t.MUTED, marginTop: 5, lineHeight: 1.5 }}>GDP estimate factor only — not a redemption or per-user rate.</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE, display: "block", marginBottom: 6 }}>Source / note *</label>
          <input value={newSource} onChange={(e) => setNewSource(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "10px 13px", background: t.INPUT_BG, border: `1px solid ${newSource ? t.ACCENT + "50" : t.BORDER_SOLID}`, borderRadius: 10, fontSize: 13, color: t.TITLE, outline: "none" }} placeholder="e.g. Owner — quarterly review" />
        </div>

        {saveError ? (
          <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 12 }}>{saveError}</div>
        ) : null}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={closeEdit} style={{ flex: 1, padding: "10px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => void save()} disabled={!canSave} style={{ flex: 2, padding: "10px", borderRadius: 9, background: canSave ? t.ACCENT : t.BORDER, border: "none", color: canSave ? "#0A0E06" : t.MUTED, fontSize: 13, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>{saving ? "Saving…" : "Save new factor"}</button>
        </div>

        {editing.history.length > 0 ? (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Prior values</div>
            {editing.history.map((h) => (
              <div key={`${h.asOf}-${h.usdRate}`} style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.SUBTLE }}>${h.usdRate}{editing.symbol ? ` / ${editing.symbol}` : ""}</span>
                  <span style={{ fontSize: 11, color: t.MUTED }}>{h.asOf}</span>
                </div>
                <div style={{ fontSize: 11, color: t.MUTED }}>{h.source}</div>
              </div>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  function CurrencyList() {
    return (
      <>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
          Active factors · {activeCount} {activeCount === 1 ? "currency" : "currencies"}
        </div>
        {currencies.length === 0 ? (
          <div style={{ padding: "28px 20px", borderRadius: 14, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, textAlign: "center", color: t.MUTED, fontSize: 13 }}>
            No active currencies to manage yet.
          </div>
        ) : (
          currencies.map((c) => {
            const fixed = isFixedBaseline(c);
            const active = c.code === editingCode;
            return (
              <div key={c.code} style={{ padding: isMobile ? "14px 16px" : "16px 20px", borderRadius: 14, background: t.SURFACE, border: `1px solid ${active ? t.ACCENT + "40" : t.BORDER_SOLID}`, marginBottom: 10, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 10 : 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 16, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: c.isServiceCredits ? `${t.ACCENT}15` : t.INPUT_BG, border: `1px solid ${c.isServiceCredits ? t.ACCENT + "30" : t.BORDER_SOLID}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: c.isServiceCredits ? t.ACCENT : t.MUTED, flexShrink: 0 }}>
                    {symbolGlyph(c)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{c.label}</div>
                    <div style={{ fontSize: 11.5, color: t.MUTED, display: "flex", gap: 14, marginTop: 3, flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={10} />{c.current ? `as of ${c.current.asOf}` : "no factor set"}
                      </span>
                      {c.current ? <span>Source: {c.current.source}</span> : null}
                    </div>
                  </div>
                  {!isMobile ? (
                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 140 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: fixed ? t.MUTED : t.ACCENT }}>{fmtFactor(c)}</div>
                      <div style={{ fontSize: 11, color: t.MUTED }}>GDP estimate factor</div>
                    </div>
                  ) : null}
                </div>
                {isMobile ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: fixed ? t.MUTED : t.ACCENT }}>{fmtFactor(c)}</div>
                    {!fixed ? (
                      <button onClick={() => openEdit(c)} style={{ padding: "7px 16px", borderRadius: 9, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        <Edit2 size={12} /> Revise
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: t.MUTED }}>Fixed baseline</span>
                    )}
                  </div>
                ) : !fixed ? (
                  <button onClick={() => openEdit(c)} style={{ padding: "7px 16px", borderRadius: 9, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <Edit2 size={12} /> Revise
                  </button>
                ) : (
                  <div style={{ padding: "7px 14px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 12, flexShrink: 0 }}>Fixed</div>
                )}
              </div>
            );
          })
        )}
      </>
    );
  }

  function InfoPanel() {
    return (
      <div style={{ padding: "20px", borderRadius: 16, background: `${t.ACCENT}06`, border: `1px solid ${t.ACCENT}20` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.ACCENT, marginBottom: 12 }}>About these factors</div>
        <div style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.7 }}>
          These USD factors normalize multi-currency activity into a single GDP estimate. They are a morale and transparency metric — never a ledger, redemption offer, or indication of what ServiceCredits are worth to any individual.
        </div>
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${t.BORDER_SOLID}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.SUBTLE, marginBottom: 6 }}>Revision protocol</div>
          <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.65 }}>Revising any currency creates a new dated row. Prior rows are never overwritten — the most recent row is always the active factor.</div>
        </div>
      </div>
    );
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  function Header() {
    return (
      <div style={{ height: 56, borderBottom: `1px solid ${t.BORDER_SOLID}`, display: "flex", alignItems: "center", padding: isMobile ? "0 16px" : "0 28px", gap: 12, background: t.HEADER, flexShrink: 0 }}>
        <Globe size={18} color={t.ACCENT} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>GDP — Currency Rate Admin</div>
          {!isMobile ? (
            <div style={{ fontSize: 12, color: t.MUTED }}>Factors used only to estimate aggregate GDP — not per-wallet values</div>
          ) : null}
        </div>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: t.ACCENT, padding: "4px 11px", borderRadius: 20, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}30`, flexShrink: 0 }}>
          <ShieldCheck size={12} /> Admin only
        </span>
      </div>
    );
  }

  function Body() {
    if (loading) {
      return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: t.MUTED, fontSize: 14, padding: 24 }}>Loading currency factors…</div>;
    }
    if (error) {
      return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14, padding: 24 }}>{error}</div>;
    }

    if (isMobile) {
      return (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 16 }}>
          {editing ? (
            <ReviseForm />
          ) : (
            <>
              <Disclaimer />
              <CurrencyList />
            </>
          )}
        </div>
      );
    }

    return (
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", gap: 28, padding: "28px 36px", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Disclaimer />
          <CurrencyList />
        </div>
        <div style={{ width: 340, flexShrink: 0 }}>
          {editing ? (
            <div style={{ padding: 20, borderRadius: 16, background: t.SURFACE, border: `1px solid ${t.ACCENT}30` }}>
              <ReviseForm />
            </div>
          ) : (
            <InfoPanel />
          )}
        </div>
      </div>
    );
  }

  return (
    // Fixed viewport height (not min-height) so this flex column is bounded and <Body> (flex:1,
    // overflowY:auto) scrolls internally. Desktop locks html/body to overflow:hidden (globals.css),
    // so the shell must own its scroll or its content is clipped and unreachable.
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: t.BG, fontFamily: "'Inter',system-ui", color: t.TITLE }}>
      <Header />
      <Body />
    </div>
  );
}
