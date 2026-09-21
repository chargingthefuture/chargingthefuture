"use client";

import type { CSSProperties } from "react";

// THE shared page-back / page-forward control for an admin list.
//
// Why any list is paged at all: loading a collection into one endless scroll means the first screen
// waits on the last row, and on a phone it means a list nobody can reach the bottom of. Each press
// here fetches one page instead, so the first screen paints immediately and the length of the list
// is a fact on screen ("Page 2 of 9") rather than something a person discovers by scrolling.
//
// It hides itself when one page holds everything, so a short list carries no chrome it does not
// need. Extracted from the Directory admin shell, which had the only copy, when the SkillsHunt
// moderation queue needed the same thing (owner report, 2026-09-20: that queue was an endless
// scroll). Any list that pages uses this — do not write a second one.
export function Pager({
  page,
  pageCount,
  loading,
  onPageChange,
  accent,
  subtle,
  border,
}: {
  page: number;
  pageCount: number;
  /** Both controls are dead while a page is in flight, so a double press cannot skip a page. */
  loading: boolean;
  onPageChange: (page: number) => void;
  accent: string;
  subtle: string;
  border: string;
}) {
  if (pageCount <= 1) return null;

  const buttonStyle = (disabled: boolean): CSSProperties => ({
    padding: "8px 14px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${border}`,
    color: disabled ? subtle : accent,
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  });

  const atStart = page <= 1 || loading;
  const atEnd = page >= pageCount || loading;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 }}>
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={atStart} style={buttonStyle(atStart)}>
        Previous
      </button>
      <span style={{ fontSize: 12, color: subtle }}>
        Page {page} of {pageCount}
      </span>
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={atEnd} style={buttonStyle(atEnd)}>
        Next
      </button>
    </div>
  );
}
