"use client";

import { HelpCircle } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getUnlockTokens } from "./unlock-shared";

// The Quora space where a stuck member can ask for their profile URL. Exported so every surface that
// requests the Quora URL points at the same place.
export const UNLOCK_QUORA_HELP_URL = "https://tiskillsnetwork.quora.com";
export const UNLOCK_QUORA_HELP_DOMAIN = "tiskillsnetwork.quora.com";

// Prominent, universal help for a member who can't find their Quora profile URL. Shown on every
// surface that asks for that URL (the submission form, the status/resubmit view, and the Commons
// verify prompt). It directs them to comment on the network's Quora space, where the team replies
// with their profile URL. Not tied to the early-Commons A/B experiment — every member sees it.
export function UnlockQuoraHelp() {
  const { theme } = useTheme();
  const tok = getUnlockTokens(theme);
  return (
    <div
      role="note"
      style={{
        marginTop: 16,
        padding: "14px 16px",
        borderRadius: 12,
        background: `${tok.ACCENT}14`,
        border: `1.5px solid ${tok.ACCENT}66`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <HelpCircle size={16} color={tok.ACCENT} style={{ flexShrink: 0, marginTop: 2 }} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: tok.TITLE, lineHeight: 1.6 }}>
          If you have trouble finding your Quora profile URL, comment on any post at{" "}
          <a
            href={UNLOCK_QUORA_HELP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: tok.ACCENT, fontWeight: 700, textDecoration: "underline" }}
          >
            {UNLOCK_QUORA_HELP_DOMAIN}
          </a>{" "}
          and I will provide you with your URL.
        </span>
      </div>
    </div>
  );
}
