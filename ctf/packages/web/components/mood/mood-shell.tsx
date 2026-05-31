"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Smile } from "lucide-react";
import { COLOR, getMoodClientId, type MoodEligibility, type Tab } from "./mood-shared";
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

  useEffect(() => {
    const id = getMoodClientId();
    setClientId(id);
    const controller = new AbortController();
    async function loadEligibility() {
      setLoading(true);
      try {
        const res = await fetch(`/api/mood/eligibility?clientId=${encodeURIComponent(id)}`, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error("Failed to check eligibility.");
        const data = (await res.json()) as MoodEligibility;
        if (!controller.signal.aborted) setEligibility(data);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Failed to load mood data.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadEligibility();
    return () => { controller.abort(); };
  }, []);

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

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <MoodIconRail tab={tab} onTab={setTab} />
      <MoodSidebar tab={tab} onTab={setTab} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Smile size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>😁 Mood — Anonymous Check-ins</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Zero tracking · Community wellness</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>🔒 Anonymous</Badge>
        </header>

        {tab === "checkin" ? (
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
        )}
      </div>

      <MoodCrisisRail />
    </div>
  );
}
