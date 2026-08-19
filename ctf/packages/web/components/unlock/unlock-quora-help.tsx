"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Loader2 } from "lucide-react";
import { failureText } from "lib/errors/client-failure";
import { useTheme } from "@/hooks/useTheme";
import { getUnlockTokens } from "./unlock-shared";

// Help for a member who cannot produce a Quora profile URL, shown on every surface that asks for one.
//
// This used to send them to the network's Quora space to comment and wait for a reply — which asks a
// person who cannot find their way around Quora to go find their way around Quora, and sends them off
// the app with no way back. Roughly half of all sign-ups stopped at this screen.
//
// Now the help is inside the app: pressing the button records the request (which is what grants the
// Commons to a member with no submission — see lib/unlock/help-requests.ts) and takes them straight
// there, where they can ask in the chat and get an answer. The verification prompt follows them, so
// the Quora URL is still asked for; it is just no longer the only thing they can do.
export function UnlockQuoraHelp() {
  const router = useRouter();
  const { theme } = useTheme();
  const tok = getUnlockTokens(theme);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function askForHelp() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock/help-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? "Could not open the Commons just now. Try again.");
        return;
      }
      // Full navigation, not a client push: the access tier is resolved on the server for the home
      // route, so the request that lands there has to be a fresh one.
      router.refresh();
      window.location.assign("/");
    } catch (caught) {
      setError(failureText(caught, { area: "unlock", op: "help_request", fallback: "Network error. Try again." }));
    } finally {
      setBusy(false);
    }
  }

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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <HelpCircle size={16} color={tok.ACCENT} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: tok.TITLE }}>Can’t find your Quora profile URL?</span>
      </div>
      <div style={{ fontSize: 13, color: tok.MUTED, lineHeight: 1.6, marginBottom: 10 }}>
        You don’t have to work it out alone. Open the Commons and ask — real people are in there, and
        I’ll help you find your profile link. You can come back and finish this whenever you’re ready.
      </div>
      <button
        type="button"
        onClick={() => void askForHelp()}
        disabled={busy}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderRadius: 10,
          border: "none",
          background: tok.ACCENT,
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? <Loader2 size={14} /> : <HelpCircle size={14} />}
        {busy ? "Opening the Commons…" : "Ask for help in the Commons"}
      </button>
      {error ? <div style={{ fontSize: 12, color: "#F87171", marginTop: 8 }}>{error}</div> : null}
    </div>
  );
}
