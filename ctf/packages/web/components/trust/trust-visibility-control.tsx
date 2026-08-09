"use client";

// The "what members see" half of the Trust card.
//
// Split out of TrustWidgetCard (rule 116) so the card stays a rendering component and this file
// owns the one piece of state and the one write call in it (POST /api/trust/visibility).
//
// The card reads as two labeled sections: the member's own signals under "Your trust", then this
// one under "What members see". That split is what makes the setting legible. It changes only what
// OTHER members get — the owner's own list never moves — so a member who changed it and watched
// their own card used to conclude it did nothing.
//
// Two rules follow from that, and both matter more than they look:
//   1. The choice is three words under the section heading — Everything / A summary / Nothing — not
//      a dropdown whose closed state showed one sentence with no heading attached to it.
//   2. The preview renders the REAL components with the peer's data, so it is the copy another
//      member actually receives rather than a description of it. No admin caveat appears anywhere
//      here: nothing in this app is end-to-end encrypted, so admin access is a given, and saying it
//      on this card only crowded out the thing the member came to read.
//
// The three choices are three real outcomes at `GET /api/trust/user/[userId]`: `public` serves the
// full panel to any signed-in member, `restricted` serves the summary projection, `private` refuses
// with 403. The owner and admins always read the full panel.
import React from "react";
import { Eye, Check } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { TrustTokens } from "./trust-shared";
import type { TrustPeerEvidenceItem, TrustVisibility } from "../../lib/trust/types";
import { TRUST_VISIBILITY_VALUES } from "../../lib/trust/types";
import { summarizeTrustEvidenceForPeer } from "../../lib/trust/peer-summary";
import { getTrustTokens } from "./trust-shared";
import { TrustEvidenceRow, TrustSummaryNote, TrustSectionLabel, TRUST_HAIRLINE } from "./trust-evidence-row";

// Display order runs most open to most private, so the three read as one scale. The exported enum
// keeps its own order for validation; this is presentation only.
const VISIBILITY_ORDER: readonly TrustVisibility[] = ["public", "restricted", "private"];

// Each choice completes the section heading — "What members see: Everything / A summary / Nothing" —
// so it is one question with three amounts, not three separate ideas. The category names
// ("Public" / "Restricted" / "Private") are deliberately not used: they named a bucket and left the
// member to work out the bucket's rules.
//
// The stored values are still `public` / `restricted` / `private`; only what the member reads
// changed. Nothing here is a promise about the rest of the app — this setting governs the trust
// card and nothing else.
const OPTION_LABEL: Record<TrustVisibility, string> = {
  public: "Everything",
  restricted: "A summary",
  private: "Nothing",
};

// The same three outcomes described from a viewer's side, for the read-only row on another member's
// card. `private` is listed for completeness; that card is never rendered, because the route refuses
// the read before there is anything to draw.
const PEER_LABEL: Record<TrustVisibility, string> = {
  public: "This member shares all their trust signals",
  restricted: "This member shares a summary of their trust signals",
  private: "This member keeps their trust signals private",
};

// A member's stored value should always be one of the three, but a row written before the column
// was constrained (or by hand) could be anything; fall back to the column default rather than
// rendering a blank control.
function normalize(value: string): TrustVisibility {
  return (TRUST_VISIBILITY_VALUES as readonly string[]).includes(value) ? (value as TrustVisibility) : "public";
}

function wrapperStyle(bordered: boolean): React.CSSProperties {
  return {
    padding: bordered ? "9px 0 0" : 0,
    marginTop: bordered ? 0 : 4,
    borderTop: bordered ? `1px solid ${TRUST_HAIRLINE}` : "none",
  };
}

// Another member's card: what they chose to share, stated from the viewer's side, never edited.
function ReadOnlyRow({ current, bordered, t }: { current: TrustVisibility; bordered: boolean; t: TrustTokens }) {
  return (
    <div style={wrapperStyle(bordered)}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Eye size={11} style={{ color: t.FAINT }} />
        <span style={{ fontSize: 11, color: t.FAINT }}>{PEER_LABEL[current]}</span>
      </div>
    </div>
  );
}

function SaveStatus({ saving, saved, error, t }: { saving: boolean; saved: boolean; error: string | null; t: TrustTokens }) {
  if (error) {
    return <div style={{ fontSize: 10, color: "#F87171", marginTop: 6, lineHeight: 1.4 }}>{error}</div>;
  }
  if (saving) {
    return <div style={{ fontSize: 10, color: t.FAINT, marginTop: 6 }}>Saving…</div>;
  }
  if (saved) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#34D399", marginTop: 6 }}>
        <Check size={11} /> Saved
      </div>
    );
  }
  return null;
}

function choiceStyle(selected: boolean, disabled: boolean, t: TrustTokens): React.CSSProperties {
  return {
    flex: 1,
    padding: "9px 4px",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: selected ? 700 : 500,
    lineHeight: 1.3,
    textAlign: "center",
    cursor: disabled ? "default" : "pointer",
    color: selected ? "#38BDF8" : t.MUTED,
    background: selected ? "rgba(56,189,248,0.14)" : t.INPUT_BG,
    border: `1px solid ${selected ? "rgba(56,189,248,0.55)" : t.BORDER_STRONG}`,
    opacity: disabled && !selected ? 0.6 : 1,
  };
}

// What another member gets at the current choice, drawn with the same components the other member's
// screen uses. `public` shows the owner's own rows unchanged; `restricted` shows the projection from
// `summarizeTrustEvidenceForPeer` — the same function the cross-user route runs, so the preview
// cannot promise something different from what peers actually receive.
function PeerPreview({ current, evidence, t }: { current: TrustVisibility; evidence: readonly TrustPeerEvidenceItem[]; t: TrustTokens }) {
  const rows = current === "public" ? [...evidence] : current === "restricted" ? summarizeTrustEvidenceForPeer(evidence) : [];

  // Nothing is rendered for `private` because nothing is what a member gets: the route refuses the
  // read, so there is no copy to show and a sentence has to stand in for the absence.
  if (current === "private") {
    return (
      <div style={{ marginTop: 8, fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>
        Nothing. The Trust card does not appear on your profile for other members.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ marginTop: 8, fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>
        Nothing yet — signals appear here once you have taken part somewhere.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8, padding: "10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${TRUST_HAIRLINE}`, display: "flex", flexDirection: "column", gap: 6 }}>
      {current === "restricted" && <TrustSummaryNote />}
      {rows.map((item, idx) => (
        <TrustEvidenceRow key={idx} item={item} />
      ))}
    </div>
  );
}

export interface TrustVisibilityControlProps {
  visibility: string;
  // Draw the top hairline when the control follows a section that needs separating.
  bordered: boolean;
  // Live control only on the signed-in member's own card; POST /api/trust/visibility is self-scope.
  editable?: boolean;
  // The member's own evidence, used to preview what a peer would see. Omitted on read-only cards.
  evidence?: readonly TrustPeerEvidenceItem[];
}

export function TrustVisibilityControl({ visibility, bordered, editable, evidence }: TrustVisibilityControlProps) {
  const { theme } = useTheme();
  const t = getTrustTokens(theme);
  const [current, setCurrent] = React.useState<TrustVisibility>(normalize(visibility));
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The confirmation is a receipt for the change just made, not a permanent state, so it clears
  // itself instead of sitting on the card until the next save.
  React.useEffect(() => {
    if (!saved) {
      return;
    }
    const timer = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(timer);
  }, [saved]);

  async function updateVisibility(next: TrustVisibility) {
    const previous = current;
    setCurrent(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/trust/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ trustVisibility: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setCurrent(previous);
        setError(body?.message ?? `Could not save what members see (status ${res.status}).`);
        return;
      }
      setSaved(true);
    } catch (err) {
      setCurrent(previous);
      setError(`Could not reach the server to save what members see: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (!editable) {
    return <ReadOnlyRow current={current} bordered={bordered} t={t} />;
  }

  return (
    <div style={wrapperStyle(bordered)}>
      <TrustSectionLabel>What members see</TrustSectionLabel>
      <div role="radiogroup" aria-label="What members see" style={{ display: "flex", gap: 6, marginTop: 7 }}>
        {VISIBILITY_ORDER.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={value === current}
            disabled={saving}
            onClick={() => {
              if (value !== current) {
                void updateVisibility(value);
              }
            }}
            style={choiceStyle(value === current, saving, t)}
          >
            {OPTION_LABEL[value]}
          </button>
        ))}
      </div>
      <PeerPreview current={current} evidence={evidence ?? []} t={t} />
      <SaveStatus saving={saving} saved={saved} error={error} t={t} />
    </div>
  );
}
