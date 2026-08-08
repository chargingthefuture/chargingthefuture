"use client";

// The "who can see my trust signals" control from the Trust widget card.
//
// Split out of TrustWidgetCard (rule 116) so the card stays a rendering component and this file
// owns the one piece of state and the one write call in it (POST /api/trust/visibility).
//
// Why the control spells out its own effect: the setting changes only what OTHER members see. The
// owner's card always renders the full evidence list whatever the setting says, so a member who
// changes it and watches their own card sees nothing move and reasonably concludes it does
// nothing. So the audience is named inside each choice, the effect is restated underneath, a live
// preview shows what a peer would actually receive, and a short confirmation appears once the
// change is stored.
//
// The three choices are three real outcomes at `GET /api/trust/user/[userId]`: `public` serves the
// full panel to any signed-in member, `restricted` serves the summary projection, `private` refuses
// with 403. The owner and admins always read the full panel.
import React from "react";
import { Eye, Check, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { TrustTokens } from "./trust-shared";
import type { TrustPeerEvidenceItem, TrustVisibility } from "../../lib/trust/types";
import { TRUST_VISIBILITY_VALUES } from "../../lib/trust/types";
import { summarizeTrustEvidenceForPeer } from "../../lib/trust/peer-summary";
import { getTrustTokens } from "./trust-shared";

// Display order runs most open to most private, so the dropdown reads as a scale. The exported enum
// keeps its own order for validation; this is presentation only.
const VISIBILITY_ORDER: readonly TrustVisibility[] = ["public", "restricted", "private"];

// The 5% hairline has no exact shell-token equivalent, so it stays as the shipped literal.
const HAIRLINE = "rgba(255,255,255,0.05)";

// Each choice names its audience in the option itself, so the effect is readable without opening
// the menu. "Admins" is stated because an admin can always read a member's trust panel.
const OPTION_LABEL: Record<TrustVisibility, string> = {
  public: "Public — any signed-in member",
  restricted: "Restricted — a summary, no detail",
  private: "Private — only you and admins",
};

const OPTION_EFFECT: Record<TrustVisibility, string> = {
  public: "Any signed-in member who opens your profile can see the signals listed above.",
  restricted:
    "Other members see how active you are, without the detail or the dates. Enough for someone to tell you take part here.",
  private: "Other members cannot open your trust panel at all. Only you and admins can see these signals.",
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// A member's stored value should always be one of the three, but a row written before the column
// was constrained (or by hand) could be anything; fall back to the column default rather than
// rendering a blank select.
function normalize(value: string): TrustVisibility {
  return (TRUST_VISIBILITY_VALUES as readonly string[]).includes(value) ? (value as TrustVisibility) : "public";
}

function wrapperStyle(bordered: boolean): React.CSSProperties {
  return {
    padding: bordered ? "9px 0 0" : 0,
    marginTop: bordered ? 0 : 4,
    borderTop: bordered ? `1px solid ${HAIRLINE}` : "none",
  };
}

// Another member's card: their setting is shown, never edited.
function ReadOnlyRow({ current, bordered, t }: { current: string; bordered: boolean; t: TrustTokens }) {
  return (
    <div style={wrapperStyle(bordered)}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Eye size={11} style={{ color: t.FAINT }} />
        <span style={{ fontSize: 11, color: t.FAINT }}>Visible to: {titleCase(current)}</span>
      </div>
    </div>
  );
}

function SaveStatus({ saving, saved, error, t }: { saving: boolean; saved: boolean; error: string | null; t: TrustTokens }) {
  if (error) {
    return <div style={{ fontSize: 10, color: "#F87171", marginTop: 5, lineHeight: 1.4 }}>{error}</div>;
  }
  if (saving) {
    return <div style={{ fontSize: 10, color: t.FAINT, marginTop: 5 }}>Saving…</div>;
  }
  if (saved) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#34D399", marginTop: 5 }}>
        <Check size={11} /> Saved
      </div>
    );
  }
  return null;
}

// Shows the member exactly what a peer sees at the current setting. This is what makes the control
// legible: the setting's whole effect is on other people's screens, so without a preview the member
// changes it, watches their own unchanged card, and concludes it does nothing.
//
// The lines come from `summarizeTrustEvidenceForPeer` — the same function the cross-user route runs
// — so the preview cannot promise something different from what peers actually receive.
function PeerPreview({ current, evidence, t }: { current: TrustVisibility; evidence: readonly TrustPeerEvidenceItem[]; t: TrustTokens }) {
  const lines = current === "restricted" ? summarizeTrustEvidenceForPeer(evidence) : [];

  return (
    <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${HAIRLINE}` }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: t.FAINT, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        What other members see
      </div>
      {current === "public" && (
        <div style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>Everything listed above, exactly as you see it.</div>
      )}
      {current === "private" && (
        <div style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>Nothing. Your panel is hidden from other members.</div>
      )}
      {current === "restricted" && lines.length === 0 && (
        <div style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>
          Nothing yet — a summary appears here once you have taken part somewhere.
        </div>
      )}
      {current === "restricted" && lines.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {lines.map((line, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={11} style={{ color: "#38BDF8", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: t.TEXT }}>{line.summary}</span>
            </div>
          ))}
        </div>
      )}
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
  const selectId = React.useId();
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
        setError(body?.message ?? `Could not save the visibility setting (status ${res.status}).`);
        return;
      }
      setSaved(true);
    } catch (err) {
      setCurrent(previous);
      setError(
        `Could not reach the server to save the visibility setting: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSaving(false);
    }
  }

  if (!editable) {
    return <ReadOnlyRow current={current} bordered={bordered} t={t} />;
  }

  return (
    <div style={wrapperStyle(bordered)}>
      <label htmlFor={selectId} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Eye size={12} style={{ color: t.SUBTLE }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: t.SUBTLE }}>Who can see your trust signals</span>
      </label>
      <select
        id={selectId}
        value={current}
        disabled={saving}
        onChange={(e) => void updateVisibility(e.target.value as TrustVisibility)}
        style={{
          width: "100%",
          padding: "9px 10px",
          borderRadius: 8,
          fontSize: 12,
          color: t.TEXT,
          background: t.INPUT_BG,
          border: `1px solid ${t.BORDER_STRONG}`,
          appearance: "auto",
        }}
      >
        {VISIBILITY_ORDER.map((value) => (
          <option key={value} value={value} style={{ color: t.BG }}>
            {OPTION_LABEL[value]}
          </option>
        ))}
      </select>
      <p style={{ fontSize: 11, color: t.MUTED, lineHeight: 1.5, margin: "6px 0 0" }}>
        {OPTION_EFFECT[current]} Your own card always shows everything, whichever one you pick.
      </p>
      <PeerPreview current={current} evidence={evidence ?? []} t={t} />
      <SaveStatus saving={saving} saved={saved} error={error} t={t} />
    </div>
  );
}
