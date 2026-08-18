"use client";

import { BackChevronButton } from "@/lib/nav/back-history";
import { useTheme } from "@/hooks/useTheme";
import { getDirectoryTokens } from "@/components/directory/shared";
import { WeaversBadge } from "./weavers-badge";

// "How it's earned" — the plain-language explainer the badge dialog links to. Signed-in only
// (the page route gates access); rendered inside the Directory's visual shell tokens because the
// badge lives on Directory profiles. Honest copy only: no "verified", no "vetted", no "trusted
// by the platform" — the platform verifies no one; the badge records real contribution.
export function WeaversEarnedPage() {
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);

  const sectionTitle = { fontSize: 12, fontWeight: 700 as const, color: t.MUTED, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 };
  const body = { fontSize: 14, color: t.SUBTLE, lineHeight: 1.65, margin: 0 };

  return (
    <div style={{ width: "100%", minHeight: "100dvh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT, display: "flex", flexDirection: "column" }}>
      <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, background: t.HEADER, flexShrink: 0 }}>
        <BackChevronButton accent={t.ACCENT} />
        <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>Weavers of the Commons</div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 64px" }}>
          {/* The badge itself, large, with its name — the thing this page explains. */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24 }}>
            <WeaversBadge size={64} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Weavers of the Commons</div>
              <div style={{ fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>
                A badge for members who steadily deliver real help to other members.
              </div>
            </div>
          </div>

          <section style={{ marginBottom: 24 }}>
            <div style={sectionTitle}>What it means</div>
            <p style={body}>
              A member with this badge has, over time, delivered real help to many different people
              across the platform — posting help, completing exchanges, hosting, training, answering.
              It marks steady, broad contribution to the community, nothing more and nothing less.
            </p>
          </section>

          <section style={{ marginBottom: 24 }}>
            <div style={sectionTitle}>How it is earned</div>
            <p style={body}>
              By actually helping. The badge is granted automatically when a member&rsquo;s
              contribution across the platform has been real, broad, and sustained. There is no
              application, no way to buy it, and no shortcut — the only way to earn it is to keep
              delivering help to other members. Anyone can earn it.
            </p>
          </section>

          <section style={{ marginBottom: 24 }}>
            <div style={sectionTitle}>No scores, no rankings</div>
            <p style={body}>
              Standing here is not a number. No score, points, tier, or leaderboard is shown anywhere
              — a member either holds the badge or simply does not yet, and nothing is ever shown on
              the profiles of members who do not.
            </p>
          </section>

          <section style={{ marginBottom: 24 }}>
            <div style={sectionTitle}>It is permanent</div>
            <p style={body}>
              Once earned, the badge stays. It records real contribution that already happened, so it
              is never removed for going quiet, taking a break, or having a hard stretch.
            </p>
          </section>

          <section>
            <div style={sectionTitle}>What it opens</div>
            <p style={body}>
              The same standing that earns this badge will open the members-only channel in the
              Commons and the private room in Chyme when they launch — spaces for the members who
              keep this community running.
            </p>
            <p style={body}>
              It also opens scheme suggestions in ClickLog: badge holders can propose a new scheme
              name while logging an incident, and a real one becomes part of the canonical list.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
