"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BG, COLOR, initials, type Member } from "./shared";

export function DirectoryProfileDetail({ member, onBack }: { member: Member; onBack: () => void }) {
  const p = member;
  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 56, borderBottom: `1px solid ${COLOR}25`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
        <button onClick={onBack} style={{ color: COLOR, background: "none", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
          ← Back
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>📇 Provider Profile</div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }}>
          <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
            <Avatar style={{ width: 80, height: 80 }}>
              <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 28, fontWeight: 800 }}>{initials(p.name)}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 15, color: "#9CA3AF", marginBottom: 8 }}>{p.jobTitle}</div>
              <Badge style={{ background: `${COLOR}15`, color: COLOR, border: `1px solid ${COLOR}30`, fontSize: 12 }}>{p.sector}</Badge>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ padding: "10px 20px", borderRadius: 10, background: COLOR, border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Book Session</button>
              <button style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: `1px solid ${COLOR}35`, color: COLOR, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Message</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Specializations</div>
              {p.skills.length > 0 ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                  {p.skills.map((s) => (
                    <Badge key={s} style={{ background: `${COLOR}15`, color: COLOR, border: `1px solid ${COLOR}30`, fontSize: 13, padding: "5px 12px" }}>{s}</Badge>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 24 }}>No skills listed yet.</div>
              )}
              <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Endorsements</div>
              <div style={{ padding: "20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "#4B5563", fontSize: 13, textAlign: "center" }}>
                No endorsements yet.
              </div>
            </div>
            <div>
              <div style={{ padding: "20px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Availability</div>
                {["Mon – Fri", "By appointment", "Accepts Service Credits ✓"].map((line) => (
                  <div key={line} style={{ fontSize: 13, color: "#E8EAF0", marginBottom: 6 }}>{line}</div>
                ))}
              </div>
              <div style={{ padding: "20px", borderRadius: 16, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, marginBottom: 8 }}>Encrypted Chat</div>
                <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>All messages are end-to-end encrypted and trauma-informed by design.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
