"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getLighthouseTokens } from "./shared";

export function LighthouseRightPanel() {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  return (
    <aside style={{ width: 280, borderLeft: `1px solid ${t.BORDER}`, background: t.HEADER, padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 12 }}>Emergency Housing</div>
      <div style={{ padding: "14px 16px", borderRadius: 12, background: "#EF444410", border: "1px solid #EF444430" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Shield size={14} style={{ color: "#EF4444" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }}>Immediate placement</span>
        </div>
        <div style={{ fontSize: 12, color: t.SUBTLE, lineHeight: 1.6 }}>
          If you need housing right now, reach out in the community support chat on the home page — emergency placements are confidential and prioritized.{" "}
          <Link href="/" style={{ color: t.ACCENT, fontWeight: 600 }}>Go to the support chat →</Link>
        </div>
      </div>
    </aside>
  );
}
