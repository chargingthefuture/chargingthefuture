"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Smile } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { useTheme } from "@/hooks/useTheme";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";
import { getMoodClientId, getMoodTokens, type MoodEligibility, type Tab } from "./mood-shared";
import { MoodLoading } from "./mood-loading";
import { MoodCheckin } from "./mood-checkin";
import { MoodCommunity } from "./mood-community";
import { MoodCrisisRail } from "./mood-crisis-rail";

// True only when the caller passed a signal that has already been aborted. Pulled out so the
// abort guards below stay single decision points instead of repeating the optional-chain check.
function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

// Fetch the eligibility payload for a pseudonymous client. Throws on a non-OK response so the
// caller's catch can surface the error message.
async function fetchMoodEligibility(id: string, signal?: AbortSignal): Promise<MoodEligibility> {
  const res = await fetch(`/api/mood/eligibility?clientId=${encodeURIComponent(id)}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error("Failed to check eligibility.");
  return (await res.json()) as MoodEligibility;
}

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
  const { theme } = useTheme();
  const t = getMoodTokens(theme);

  // Fetch eligibility for this pseudonymous client. Shared by the initial mount effect
  // (initial = true, shows the full-screen loading state) and the header refresh button
  // (initial = false, re-pulls in the background).
  const loadEligibility = useCallback(async (id: string, initial = false, signal?: AbortSignal) => {
    if (initial) setLoading(true);
    try {
      const data = await fetchMoodEligibility(id, signal);
      if (!isAborted(signal)) setEligibility(data);
    } catch (e) {
      if (!isAborted(signal)) setError(e instanceof Error ? e.message : "Failed to load mood data.");
    } finally {
      if (initial && !isAborted(signal)) setLoading(false);
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

    const tabs: { key: Tab; label: string }[] = [
      { key: "checkin", label: "Check-in" },
      { key: "community", label: "Community" },
    ];
    return (
      <div style={{ minHeight: "100dvh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
            <BackChevronButton accent={t.ACCENT} />
            <Smile size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            {/* Title shrinks and truncates so the trailing controls stay on screen */}
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Mood</span>
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
