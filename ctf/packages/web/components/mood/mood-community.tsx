"use client";

// Community Pulse tab. Renders the real aggregate from GET /api/mood/community:
// a 7-day average-mood chart plus headline counts. The backend returns only
// counts and per-day averages — never per-user rows — and suppresses the data
// until a minimum number of check-ins exist, so a clean empty state shows first.
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart2, Lock, Shield, Smile } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import {
  getMoodTokens,
  moodFaceForAverage,
  weekdayLabel,
  type MoodCommunityPulse,
  type MoodCommunityResponse,
} from "./mood-shared";

function PrivacyFooter() {
  const { theme } = useTheme();
  const t = getMoodTokens(theme);
  return (
    <>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { icon: Shield, label: "Anonymous by design" },
          { icon: Lock, label: "No personal data in trends" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: t.MUTED }}>
            <Icon size={14} color={t.ACCENT} /> {label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: `${t.MUTED}90` }}>
        <BarChart2 size={12} color={t.MUTED} /> Aggregated across the whole community — individual check-ins are never shown.
      </div>
    </>
  );
}

function EmptyPulse({ message }: { message: string }) {
  const { theme } = useTheme();
  const t = getMoodTokens(theme);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48 }}>
      <div style={{ maxWidth: 460, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: `${t.ACCENT}10`, border: `2px dashed ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Smile size={34} color={`${t.ACCENT}60`} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE }}>Not enough check-ins yet</div>
        <div style={{ fontSize: 14, color: t.MUTED, lineHeight: 1.7 }}>{message}</div>
        <PrivacyFooter />
      </div>
    </div>
  );
}

function PulseChart({ pulse }: { pulse: MoodCommunityPulse }) {
  const { theme } = useTheme();
  const t = getMoodTokens(theme);
  const maxScale = 5;
  const headline = moodFaceForAverage(pulse.averageMood);
  return (
    <div style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Community Wellness Trends</div>
        <div style={{ fontSize: 14, color: t.MUTED }}>Aggregated anonymous data · Individual data never exposed</div>
      </div>

      {/* Headline cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <div style={{ padding: 20, borderRadius: 14, background: `${headline.color}10`, border: `1px solid ${headline.color}25`, textAlign: "center" }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>{headline.emoji}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: headline.color, marginTop: 6 }}>{pulse.averageMood?.toFixed(1) ?? "—"}<span style={{ fontSize: 14, color: t.MUTED, fontWeight: 600 }}> / 5</span></div>
          <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2 }}>Average mood ({pulse.windowDays}-day)</div>
        </div>
        <div style={{ padding: 20, borderRadius: 14, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}20`, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: t.ACCENT }}>{pulse.totalCount.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: t.MUTED, marginTop: 6 }}>Check-ins this week</div>
        </div>
      </div>

      {/* 7-day chart */}
      <div style={{ padding: "24px", borderRadius: 16, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>{pulse.windowDays}-Day Community Mood</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 140 }}>
          {pulse.days.map((day) => {
            const face = moodFaceForAverage(day.averageMood);
            const heightPx = day.averageMood ? Math.max(8, (day.averageMood / maxScale) * 90) : 0;
            return (
              <div key={day.dateIso} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, justifyContent: "flex-end", height: "100%" }}>
                <div style={{ fontSize: 15 }}>{day.averageMood ? face.emoji : ""}</div>
                {day.averageMood ? (
                  <div style={{ width: "100%", borderRadius: "6px 6px 0 0", background: `linear-gradient(to top, ${t.ACCENT}, ${t.ACCENT}60)`, height: `${heightPx}px` }} />
                ) : (
                  <div style={{ width: "100%", borderRadius: "6px 6px 0 0", background: t.INPUT_BG, border: `1px dashed ${t.BORDER_SOLID}`, height: 24 }} />
                )}
                <span style={{ fontSize: 10, color: t.MUTED }}>{weekdayLabel(day.dateIso)}</span>
                <span style={{ fontSize: 10, color: t.ACCENT, fontWeight: 700 }}>{day.averageMood ? day.averageMood.toFixed(1) : "·"}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <PrivacyFooter />
      </div>
    </div>
  );
}

export function MoodCommunity() {
  const { theme } = useTheme();
  const t = getMoodTokens(theme);
  const [pulse, setPulse] = useState<MoodCommunityPulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/mood/community", { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error("Community pulse unavailable.");
        const data = (await res.json()) as MoodCommunityResponse;
        if (!controller.signal.aborted) setPulse(data.pulse);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Community pulse unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => { controller.abort(); };
  }, []);

  let body;
  if (loading) {
    body = (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48, color: t.MUTED, fontSize: 14 }}>
        Loading community pulse…
      </div>
    );
  } else if (error) {
    body = <EmptyPulse message="The community pulse could not be loaded right now. Please try again shortly." />;
  } else if (!pulse || !pulse.hasEnoughData) {
    body = <EmptyPulse message="Aggregated community mood trends appear here once enough members have checked in. All data is fully anonymous — no names, no IDs, only mood scores by day." />;
  } else {
    body = (
      <div style={{ flex: 1, padding: 24 }}>
        <PulseChart pulse={pulse} />
      </div>
    );
  }

  return <ScrollArea style={{ flex: 1 }}>{body}</ScrollArea>;
}
