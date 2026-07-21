"use client";

import Link from "next/link";
import { useTheme } from "@/hooks/useTheme";
import { getMoodTokens } from "./mood-shared";

// Owner decision: instead of external crisis-hotline numbers, point a struggling member to the
// community's own people — find a member with mental-health expertise in the Directory, or reach out
// through Foundation to talk with them. These are internal app links (SPA navigation), not phone
// numbers.
const SUPPORT_LINKS = [
  {
    href: "/apps/directory",
    title: "Find someone in the Directory",
    detail: "Search community members by specialty — including people with mental-health expertise.",
  },
  {
    href: "/apps/foundation",
    title: "Reach out through Foundation",
    detail: "Connect and talk it through with a community member who can help.",
  },
];

export function MoodCrisisRail() {
  const { theme } = useTheme();
  const t = getMoodTokens(theme);
  // The rail stacks below the content, so span the width and center it (capped so
  // it does not stretch too wide on large phones/tablets) with a top divider.
  return (
    <aside
      style={{ width: "100%", maxWidth: 480, margin: "0 auto", borderTop: `1px solid ${t.BORDER}`, background: t.HEADER, padding: "20px 16px", boxSizing: "border-box" }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 6 }}>Talk to someone</div>
      <div style={{ fontSize: 12, color: t.SUBTLE, lineHeight: 1.6, marginBottom: 12 }}>If you&apos;re struggling, reach a community member with mental-health expertise.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {SUPPORT_LINKS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            style={{ display: "block", padding: "12px 14px", borderRadius: 12, background: `${t.ACCENT}0F`, border: `1px solid ${t.ACCENT}30`, textDecoration: "none" }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT, marginBottom: 3 }}>{r.title}</div>
            <div style={{ fontSize: 11.5, color: t.SUBTLE, lineHeight: 1.5 }}>{r.detail}</div>
          </Link>
        ))}
      </div>
      <div style={{ padding: "14px 16px", borderRadius: 12, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}18` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.ACCENT, marginBottom: 8 }}>🔒 Privacy First</div>
        <div style={{ fontSize: 12, color: t.SUBTLE, lineHeight: 1.6 }}>Your mood check-ins are pseudonymous — stored under a random ID kept separate from your account, and never shown to anyone. Community trends are anonymous and aggregate-only. One check-in per week.</div>
      </div>
    </aside>
  );
}
