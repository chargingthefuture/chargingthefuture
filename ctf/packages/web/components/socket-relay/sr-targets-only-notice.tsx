"use client";

import { ShieldAlert } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getSocketRelayTokens } from "./sr-shared";

// Who the board is for, and why an outsider should stay off it.
//
// SocketRelay reads like an open help board, so a well-meaning stranger who finds a post — through a
// shared link, or a job posting that points here — sees no reason not to answer. That is the danger
// this notice exists to name: a person who steps in from outside is noticed, approached, and pressed
// to take part in the trafficking, and refusing has cost people their lives or made them targets.
// The warning has to sit where someone decides to respond, not in a policy page nobody opens, so it
// renders above the feed, on the signed-out view, and on the post form.
//
// Wording is the owner's (2026-08-01). Keep it plain and unsensational: this is a safety fact, and
// dressing it up would make it easier to dismiss.
export function SrTargetsOnlyNotice() {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  return (
    <section
      aria-label="Who these posts are for"
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "14px 16px",
        borderRadius: 12,
        background: "rgba(245,158,11,0.08)",
        border: "1px solid rgba(245,158,11,0.28)",
      }}
    >
      <ShieldAlert size={16} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 13, lineHeight: 1.6, color: t.TEXT, overflowWrap: "anywhere" }}>
        <strong style={{ display: "block", marginBottom: 4, color: t.TITLE }}>
          These posts are for Targeted Individuals
        </strong>
        Everything here is addressed to people already living under organized targeting.
        <br />
        <br />
        If you are not targeted, please do not offer help here. People who step in from outside get
        noticed. They are approached and asked to take part in the trafficking, and those who refuse
        have been killed or have become targets themselves. Nobody here is asking you to carry that
        risk on our behalf — the useful thing an outsider can do right now is wait until trafficking
        is actually enforced.
      </div>
    </section>
  );
}
