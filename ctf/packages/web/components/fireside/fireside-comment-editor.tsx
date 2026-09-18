"use client";

import { useState } from "react";
import type { PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import { FIRESIDE_MAX_COMMENT_LENGTH } from "@/lib/fireside/constants";

// The box an author rewrites their own comment in.
//
// Its own file because both screens that show somebody their own words need it — the thread, where
// a typo is spotted a second after posting, and the member's own comment list — and because the
// alternative was each of them growing a second composer of its own.
//
// It holds the draft and nothing else. Whether the comment may be edited at all, and what happens
// to a blog-export approval when it is, are decided on the server (lib/fireside/visibility.ts and
// lib/fireside/export-review.ts); a control that decided any of that for itself would be a second
// copy of the rule.

export function FiresideCommentEditor({
  t,
  initialBody,
  busy,
  onSave,
  onCancel,
}: {
  t: PluginShellTokens;
  initialBody: string;
  busy: boolean;
  onSave: (body: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialBody);
  const trimmed = draft.trim();
  // Nothing to save when the box is empty or the words are the ones already there.
  const unchanged = trimmed.length === 0 || trimmed === initialBody.trim();
  const tooLong = trimmed.length > FIRESIDE_MAX_COMMENT_LENGTH;

  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        aria-label="Rewrite your comment"
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: t.INPUT_BG,
          border: `1px solid ${t.BORDER}`,
          borderRadius: 10,
          padding: 12,
          fontSize: 15,
          color: t.TEXT,
          lineHeight: 1.6,
        }}
      />
      {tooLong && (
        <div style={{ fontSize: 13, color: "#F87171", marginTop: 4 }}>
          That is {trimmed.length} characters, and {FIRESIDE_MAX_COMMENT_LENGTH} is the limit. Shorten
          it, or say the rest in a reply.
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
        <button
          type="button"
          disabled={busy || unchanged || tooLong}
          onClick={() => onSave(trimmed)}
          style={{
            background: t.ACCENT,
            color: "#000",
            border: "none",
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 14,
            fontWeight: 600,
            cursor: busy || unchanged || tooLong ? "default" : "pointer",
            opacity: busy || unchanged || tooLong ? 0.5 : 1,
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          style={{
            background: "transparent",
            border: "none",
            color: t.SUBTLE,
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            padding: 0,
          }}
        >
          Cancel
        </button>
      </div>
      {/* Said before the change is made rather than after it: the edit is visible as an edit, and
          an approval an admin gave to the old words does not carry over to the new ones. */}
      <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.6, marginTop: 6 }}>
        Saving marks the comment as edited. Replies and reactions on it stay where they are. If an
        admin had already approved it for the blog, the new wording goes back for another read.
      </div>
    </div>
  );
}
