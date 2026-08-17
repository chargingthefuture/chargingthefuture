"use client";

import { MAX_SCHEME_SUGGESTION_LENGTH } from "../../lib/click-log/constants";
import type { ClickLogTokens } from "./click-log-shared";

// The "Not listed" scheme-suggestion inputs, shown only while the catch-all scheme tag is
// picked. Unlike the incident note (never shared), both fields are EXPLICITLY shared with the
// owner and say so — the description is the intake that lets new schemes earn a name, and the
// optional Quora self-link helps the owner tell real reports from spam. The description is
// required: the form's Submit stays disabled until it has text (the server enforces the same),
// and the whole flow is limited to Weavers of the Commons badge holders (non-holders never see
// the "Not listed" option).
export function ClickLogSchemeSuggestionFields({
  suggestion,
  quoraUrl,
  tokens,
  onSuggestionChange,
  onQuoraUrlChange,
}: {
  suggestion: string;
  quoraUrl: string;
  tokens: ClickLogTokens;
  onSuggestionChange: (value: string) => void;
  onQuoraUrlChange: (value: string) => void;
}) {
  const t = tokens;
  return (
    <div style={{ marginTop: 10, padding: "12px", borderRadius: 10, background: t.INPUT_BG, border: `1px solid ${t.ACCENT}30` }}>
      <label style={{ display: "block" }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.TITLE, marginBottom: 4 }}>
          Describe the scheme (required — shared with the owner)
        </span>
        <textarea
          value={suggestion}
          onChange={(e) => onSuggestionChange(e.target.value)}
          rows={2}
          maxLength={MAX_SCHEME_SUGGESTION_LENGTH}
          placeholder="What did they do? A sentence or two is enough…"
          style={{ width: "100%", padding: "8px 10px", background: t.BG, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 8, fontSize: 13, color: t.TITLE, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
        />
      </label>
      <label style={{ display: "block", marginTop: 8 }}>
        <span style={{ display: "block", fontSize: 12, color: t.MUTED, marginBottom: 4 }}>
          Link to your Quora post about a similar incident (optional — shared with the owner)
        </span>
        <input
          type="url"
          value={quoraUrl}
          onChange={(e) => onQuoraUrlChange(e.target.value)}
          placeholder="https://www.quora.com/…"
          style={{ width: "100%", padding: "8px 10px", background: t.BG, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 8, fontSize: 13, color: t.TITLE, outline: "none", boxSizing: "border-box" }}
        />
      </label>
      <div style={{ marginTop: 8, fontSize: 11, color: t.MUTED, lineHeight: 1.5 }}>
        Your description (and link, if added) goes to the owner so new schemes can be named.
        Your note above stays private, as always.
      </div>
    </div>
  );
}
