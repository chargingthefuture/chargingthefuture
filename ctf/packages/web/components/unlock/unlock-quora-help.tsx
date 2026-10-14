"use client";

import { useState } from "react";
import { HelpCircle, Loader2 } from "lucide-react";
import { failureText } from "lib/errors/client-failure";
import { UNLOCK_QUORA_HINT_MAX_LENGTH as QUORA_HINT_MAX_LENGTH } from "lib/unlock/quora-hint";
import { QUORA_URL_HELP_IMAGE, QUORA_URL_HELP_ORDER, QUORA_URL_HELP_STEPS } from "lib/unlock/quora-url-help-steps";
import { useTheme } from "@/hooks/useTheme";
import { getUnlockTokens, type UnlockTokens } from "./unlock-shared";

// Help for a member who cannot produce a Quora profile URL, shown on every surface that asks for one:
// the Unlock screen, and the verification banner above the Commons chat. One implementation for both,
// so the steps, the picture and the hint box cannot drift apart.
//
// This used to send them to the network's Quora space to comment and wait for a reply — which asks a
// person who cannot find their way around Quora to go find their way around Quora, and sends them off
// the app with no way back. Roughly half of all sign-ups stopped at this screen.
//
// Now the help is inside the app. On the Unlock screen, pressing the button records the request
// (which is what grants the Commons to a member with no submission — see lib/unlock/help-requests.ts)
// and takes them straight there, where they can ask @comic in the chat. In the Commons they are
// already there, so the button only saves what they wrote in the box.
//
// The box is the second half of that. Somebody who cannot produce a profile URL can almost always say
// the name on their Quora account, or paste a link to something they posted, and that is enough for an
// admin to find them and approve them by hand. Before it existed, pressing the button recorded a user
// id and a date, so the people who most needed a manual approval were the only ones with nothing on
// file to approve. Optional on the Unlock screen, where the button works with it empty.
//
// The "Show me where to find it" steps are the same text the scripted @comic answer is built from
// (lib/unlock/quora-url-help-steps.ts).

type HelpWhere = "unlock" | "commons";

const COPY: Record<HelpWhere, { body: string; idle: string; busy: string; failed: string }> = {
  unlock: {
    body: "You don’t have to work it out alone. Open the Commons and ask — real people are in there, and I’ll help you find your profile link. You can come back and finish this whenever you’re ready.",
    idle: "Ask for help in the Commons",
    busy: "Opening the Commons…",
    failed: "Could not open the Commons just now. Try again.",
  },
  commons: {
    body: "Ask in the chat just below — start your message with @comic, or tap “I can’t find my Quora profile URL” under the chat. Nothing here expires while you wait.",
    idle: "Send this to the team",
    busy: "Sending…",
    failed: "Could not send that just now. Try again.",
  },
};

function HelpSteps({ tok }: { tok: UnlockTokens }) {
  return (
    <details style={{ marginBottom: 12 }}>
      <summary style={{ fontSize: 13, fontWeight: 700, color: tok.ACCENT, cursor: "pointer" }}>
        Show me where to find it
      </summary>
      {/* A plain img: a static SVG in /public, which next/image would not resize anyway. */}
      <img
        src={QUORA_URL_HELP_IMAGE.src}
        alt={QUORA_URL_HELP_IMAGE.alt}
        width={640}
        height={400}
        style={{ display: "block", width: "100%", height: "auto", borderRadius: 10, margin: "10px 0" }}
      />
      {QUORA_URL_HELP_ORDER.map((key) => {
        const block = QUORA_URL_HELP_STEPS[key];
        return (
          <div key={key} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: tok.TITLE }}>{block.heading}</div>
            <ol style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: 13, color: tok.MUTED, lineHeight: 1.6 }}>
              {block.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        );
      })}
    </details>
  );
}

function HintField({ tok, hint, onChange }: { tok: UnlockTokens; hint: string; onChange: (value: string) => void }) {
  return (
    <>
      <label
        htmlFor="unlock-quora-hint"
        style={{ display: "block", fontSize: 13, fontWeight: 700, color: tok.TITLE, marginBottom: 6 }}
      >
        Anything that helps me find you on Quora (optional)
      </label>
      <input
        id="unlock-quora-hint"
        value={hint}
        onChange={(event) => onChange(event.target.value)}
        maxLength={QUORA_HINT_MAX_LENGTH}
        placeholder="The name on your Quora account, or a link to anything you posted"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          marginBottom: 6,
          borderRadius: 10,
          background: tok.INPUT_BG,
          border: `1px solid ${hint ? `${tok.ACCENT}80` : tok.BORDER_SOLID}`,
          color: tok.TITLE,
          fontSize: 14,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
      <div style={{ fontSize: 12, color: tok.MUTED, lineHeight: 1.6, marginBottom: 12 }}>
        It doesn’t have to be a link. A name or an email is enough for me to look you up and approve
        you by hand.
      </div>
    </>
  );
}

// Post the hint (and, on the Unlock screen, the help request itself). Resolves to an error message,
// or null on success.
async function sendHelpRequest(hint: string, failed: string): Promise<string | null> {
  try {
    const res = await fetch("/api/unlock/help-request", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
      body: JSON.stringify({ quoraHint: hint.trim() }),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    return data?.message ?? failed;
  } catch (caught) {
    return failureText(caught, { area: "unlock", op: "help_request", fallback: "Network error. Try again." });
  }
}

function HelpError({ tok, error, where }: { tok: UnlockTokens; error: string; where: HelpWhere }) {
  return (
    <div style={{ fontSize: 12, color: "#F87171", marginTop: 8, lineHeight: 1.6 }}>
      {error}{" "}
      {/* Never leave them on a screen whose only action did nothing. The Commons may still be
          reachable — if it is not, they land back here rather than nowhere. */}
      {where === "unlock" ? (
        <a href="/" style={{ color: tok.ACCENT, fontWeight: 700, textDecoration: "underline" }}>
          Try opening the Commons anyway
        </a>
      ) : null}
    </div>
  );
}

function HelpButton(props: { tok: UnlockTokens; busy: boolean; disabled: boolean; label: string; onPress: () => void }) {
  const { tok, busy, disabled, label, onPress } = props;
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
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
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {busy ? <Loader2 size={14} /> : <HelpCircle size={14} />}
      {label}
    </button>
  );
}

// In the Commons the button only saves the box, so an empty box has nothing to send.
function isHelpDisabled(busy: boolean, where: HelpWhere, hint: string): boolean {
  if (busy) return true;
  return where === "commons" && hint.trim().length === 0;
}

export function UnlockQuoraHelp({ alreadyVerified = false, where = "unlock" }: { alreadyVerified?: boolean; where?: HelpWhere }) {
  const { theme } = useTheme();
  const tok = getUnlockTokens(theme);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hint, setHint] = useState("");
  const copy = COPY[where];

  // An approved member already has the Commons and everything else. Offering to "open the Commons"
  // for them is at best noise on a screen that just told them they are done, and the button would
  // record a help request nobody needs.
  if (alreadyVerified) {
    return null;
  }

  const disabled = isHelpDisabled(busy, where, hint);

  async function askForHelp() {
    if (disabled) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const failure = await sendHelpRequest(hint, copy.failed);
    if (failure) {
      setError(failure);
      setBusy(false);
      return;
    }
    if (where === "unlock") {
      // Full navigation, not a client push: the home route resolves access on the server, so the
      // request that lands there has to be a fresh one. Deliberately no router.refresh() first — it
      // repaints the screen we are leaving, which reads as a flash and buys nothing, since a full
      // navigation re-runs the server anyway.
      window.location.assign("/");
      return;
    }
    setSaved(true);
    setBusy(false);
  }

  return (
    <div
      role="note"
      style={{
        marginTop: where === "unlock" ? 16 : 12,
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
      <div style={{ fontSize: 13, color: tok.MUTED, lineHeight: 1.6, marginBottom: 10 }}>{copy.body}</div>
      <HelpSteps tok={tok} />
      <HintField tok={tok} hint={hint} onChange={setHint} />
      <HelpButton tok={tok} busy={busy} disabled={disabled} label={busy ? copy.busy : copy.idle} onPress={() => void askForHelp()} />
      {saved ? (
        <div role="status" style={{ fontSize: 12, color: tok.MUTED, marginTop: 8, lineHeight: 1.6 }}>
          Saved. A person will use it to look you up.
        </div>
      ) : null}
      {error ? <HelpError tok={tok} error={error} where={where} /> : null}
    </div>
  );
}
