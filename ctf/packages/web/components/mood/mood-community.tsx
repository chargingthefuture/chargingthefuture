"use client";

// Community Pulse tab. There is no aggregate-stats backend yet (only
// eligibility + submissions exist), so per the design's empty state this shows
// the honest "data appears once members check in" placeholder rather than the
// mockup's fabricated 7-day averages and distribution percentages.
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart2, Lock, Shield, Smile } from "lucide-react";
import { BORDER, COLOR, DAYS, SUBTLE, SURFACE, TEXT } from "./mood-shared";

export function MoodCommunity() {
  return (
    <ScrollArea style={{ flex: 1 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ maxWidth: 460, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: `${COLOR}10`, border: `2px dashed ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Smile size={34} color={`${COLOR}60`} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Community pulse coming soon</div>
          <div style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.7 }}>
            Aggregated community mood trends appear here once enough members have checked in. All data is fully anonymous — no names, no IDs, only aggregated mood scores by day.
          </div>

          <div style={{ width: "100%", borderRadius: 14, border: `1px solid ${BORDER}`, background: SURFACE, padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: SUBTLE }}>7-day community average</span>
              <span style={{ fontSize: 12, color: `${SUBTLE}80` }}>Waiting for check-ins…</span>
            </div>
            <div style={{ display: "flex", gap: 8, height: 80, alignItems: "flex-end" }}>
              {DAYS.map((day) => (
                <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, width: "100%", borderRadius: "4px 4px 0 0", background: "rgba(255,255,255,0.04)", border: `1px dashed ${BORDER}`, minHeight: 40 }} />
                  <span style={{ fontSize: 10, color: `${SUBTLE}60` }}>{day}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 24 }}>
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
            <BarChart2 size={12} color={SUBTLE} /> Trends populate as the community grows.
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
