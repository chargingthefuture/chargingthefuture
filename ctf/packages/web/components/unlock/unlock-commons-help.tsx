"use client";

import { MessageCircle } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getUnlockTokens } from "./unlock-shared";

// Shown only to the "early Commons access" experiment treatment group. It links from the Unlock
// screen into the Commons (the Hub general channel) so a member who is stuck — for example, having
// trouble finding their Quora profile URL — can ask for help instead of being confined to the Unlock
// screen. The link points at "/", which renders the Commons for a treatment-bucket member (see
// app/page.tsx); a control member never sees this link and could not post there anyway.
export function UnlockCommonsHelp() {
  const { theme } = useTheme();
  const tok = getUnlockTokens(theme);
  return (
    <a
      href="/"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        marginTop: 16,
        padding: "11px 16px",
        borderRadius: 12,
        background: `${tok.ACCENT}10`,
        border: `1px solid ${tok.ACCENT}33`,
        color: tok.ACCENT,
        fontSize: 13,
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      <MessageCircle size={14} style={{ flexShrink: 0 }} />
      Trouble finding your Quora URL? Ask in the Commons
    </a>
  );
}
