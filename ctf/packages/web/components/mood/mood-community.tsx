"use client";

// Community Pulse tab. Renders the real aggregate from GET /api/mood/community:
// a 7-day average-mood chart plus headline counts. The backend returns only
// counts and per-day averages — never per-user rows — and suppresses the data
// until a minimum number of check-ins exist, so a clean empty state shows first.
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart2, Lock, Shield, Smile } from "lucide-react";
import {
  BORDER,
  COLOR,
  SUBTLE,
  SURFACE,
  TEXT,
  moodFaceForAverage,
  weekdayLabel,
  type MoodCommunityPulse,
  type MoodCommunityResponse,
} from "./mood-shared";

function PrivacyFooter() {
  return (
    <>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { icon: Shield, label: "Anonymous by design" },
          { icon: Lock, label: "Zero personal data stored" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: SUBTLE }}>
            <Icon size={14} color={COLOR} /> {label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: `${SUBTLE}90` }}>
        <BarChart2 size={12} color={SUBTLE} /> Aggregated across the whole community — individual check-ins are never shown.
      </div>
    </>
  );
}

function EmptyPulse({ message }: { message: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48 }}>
      <div style={{ maxWidth: 460, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: `${COLOR}10`, border: `2px dashed ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Smile size={34} color={`${COLOR}60`} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Not enough check-ins yet</div>
        <div style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.7 }}>{message}</div>
        <PrivacyFooter />
      </div>
    </div>
  );
}

function PulseChart({ pulse }: { pulse: MoodCommunityPulse }) {
  const maxScale = 5;
  const headline = moodFaceForAverage(pulse.averageMood);
  return (
    <div style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 4 }}>Community Wellness Trends</div>
        <div style={{ fontSize: 14, color: SUBTLE }}>Aggregated anonymous data · Individual data never exposed</div>
      </div>

      {/* Headline cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <div style={{ padding: 20, borderRadius: 14, background: `${headline.color}10`, border: `1px solid ${headline.color}25`, textAlign: "center" }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>{headline.emoji}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: headline.color, marginTop: 6 }}>{pulse.averageMood?.toFixed(1) ?? "—"}<span style={{ fontSize: 14, color: SUBTLE, fontWeight: 600 }}> / 5</span></div>
          <div style={{ fontSize: 12, color: SUBTLE, marginTop: 2 }}>Average mood ({pulse.windowDays}-day)</div>
        </div>
        <div style={{ padding: 20, borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: COLOR }}>{pulse.totalCount.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: SUBTLE, marginTop: 6 }}>Check-ins this week</div>
        </div>
      </div>

      {/* 7-day chart */}
      <div style={{ padding: "24px", borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>{pulse.windowDays}-Day Community Mood</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 140 }}>
          {pulse.days.map((day) => {
            const face = moodFaceForAverage(day.averageMood);
            const heightPx = day.averageMood ? Math.max(8, (day.averageMood / maxScale) * 90) : 0;
            return (
              <div key={day.dateIso} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, justifyContent: "flex-end", height: "100%" }}>
                <div style={{ fontSize: 15 }}>{day.averageMood ? face.emoji : ""}</div>
                {day.averageMood ? (
                  <div style={{ width: "100%", borderRadius: "6px 6px 0 0", background: `linear-gradient(to top, ${COLOR}, ${COLOR}60)`, height: `${heightPx}px` }} />
                ) : (
                  <div style={{ width: "100%", borderRadius: "6px 6px 0 0", background: "rgba(255,255,255,0.04)", border: `1px dashed ${BORDER}`, height: 24 }} />
                )}
                <span style={{ fontSize: 10, color: SUBTLE }}>{weekdayLabel(day.dateIso)}</span>
                <span style={{ fontSize: 10, color: COLOR, fontWeight: 700 }}>{day.averageMood ? day.averageMood.toFixed(1) : "·"}</span>
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
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48, color: SUBTLE, fontSize: 14 }}>
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
