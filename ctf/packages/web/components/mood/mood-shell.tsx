"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Smile } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useTheme } from "@/hooks/useTheme";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";
import { getMoodClientId, getMoodTokens, type MoodEligibility, type Tab } from "./mood-shared";
import { MoodLoading } from "./mood-loading";
import { MoodIconRail } from "./mood-icon-rail";
import { MoodSidebar } from "./mood-sidebar";
import { MoodCheckin } from "./mood-checkin";
import { MoodCommunity } from "./mood-community";
import { MoodCrisisRail } from "./mood-crisis-rail";

export default function MoodShell() {
  const [tab, setTab] = useState<Tab>("checkin");
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState("");
  const [eligibility, setEligibility] = useState<MoodEligibility | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getMoodTokens(theme);

  // Fetch eligibility for this pseudonymous client. Shared by the initial mount effect
  // (initial = true, shows the full-screen loading state) and the header refresh button
  // (initial = false, re-pulls in the background).
  const loadEligibility = useCallback(async (id: string, initial = false, signal?: AbortSignal) => {
    if (initial) setLoading(true);
    try {
      const res = await fetch(`/api/mood/eligibility?clientId=${encodeURIComponent(id)}`, { signal, cache: "no-store" });
      if (!res.ok) throw new Error("Failed to check eligibility.");
      const data = (await res.json()) as MoodEligibility;
      if (!signal?.aborted) setEligibility(data);
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "Failed to load mood data.");
    } finally {
      if (initial && !signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = getMoodClientId();
    setClientId(id);
    const controller = new AbortController();
    void loadEligibility(id, true, controller.signal);
    return () => { controller.abort(); };
  }, [loadEligibility]);

  async function handleSubmit() {
    if (!selected || submitting || !clientId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/mood/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ clientId, moodValue: selected, note: note.trim() ? note.trim() : null }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Submission failed.");
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <MoodLoading />;

  const content = tab === "checkin" ? (
    <MoodCheckin
      eligibility={eligibility}
      selected={selected}
      onSelect={setSelected}
      note={note}
      onNoteChange={setNote}
      submitting={submitting}
      submitted={submitted}
      error={error}
      onSubmit={() => void handleSubmit()}
      onViewCommunity={() => setTab("community")}
    />
  ) : (
    <MoodCommunity />
  );

  if (isMobile) {
    const tabs: { key: Tab; label: string }[] = [
      { key: "checkin", label: "Check-in" },
      { key: "community", label: "Community" },
    ];
    return (
      <div style={{ minHeight: "100dvh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <Smile size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1 }}>Mood</span>
            <Badge style={{ background: `${t.ACCENT}20`, color: t.ACCENT, border: `1px solid ${t.ACCENT}35`, fontSize: 10, padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>🔒 Pseudonymous</Badge>
            <RefreshButton onRefresh={() => loadEligibility(clientId)} title="Refresh" />
            <MobileTopActions />
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? `${t.ACCENT}1A` : "transparent", border: `1px solid ${tab === key ? t.ACCENT + "40" : t.BORDER_STRONG}`, color: tab === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        </div>
        {content}
        <MoodCrisisRail />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100dvh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT, display: "flex" }}>
      <MoodIconRail tab={tab} onTab={setTab} />
      <MoodSidebar tab={tab} onTab={setTab} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: t.HEADER, flexShrink: 0 }}>
          <Smile size={18} style={{ color: t.ACCENT }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.TEXT }}>😁 Mood — Pseudonymous Check-ins</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Private check-ins · Community wellness</div>
          </div>
          <Badge style={{ background: `${t.ACCENT}20`, color: t.ACCENT, border: `1px solid ${t.ACCENT}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>🔒 Pseudonymous</Badge>
          <RefreshButton onRefresh={() => loadEligibility(clientId)} title="Refresh" />
        </header>

        {content}
      </div>

      <MoodCrisisRail />
    </div>
  );
}
