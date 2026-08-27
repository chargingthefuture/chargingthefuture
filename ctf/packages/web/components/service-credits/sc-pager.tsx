"use client";

// Page controls for a ServiceCredits list. Lists here move a page at a time rather than scrolling
// without a bottom, so a member always knows how much history there is and where they are in it.
// Wording matches the paged lists elsewhere in the app (Previous · Page N of M · Next).
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getServiceCreditsTokens } from "./sc-shared";

type Props = {
  // Zero-based index of the page being shown.
  page: number;
  pageCount: number;
  onPageChange: (next: number) => void;
  // Short line naming what is being paged, e.g. "42 transactions". Shown beside the controls.
  summary: string;
  // True while the next page is in flight, so the controls stop a second click landing mid-load.
  busy?: boolean;
};

export function ServiceCreditsPager({ page, pageCount, onPageChange, summary, busy = false }: Props) {
  const { theme } = useTheme();
  const t = getServiceCreditsTokens(theme);
  if (pageCount <= 1) {
    return null;
  }

  const atStart = page <= 0 || busy;
  const atEnd = page >= pageCount - 1 || busy;
  const buttonStyle = (disabled: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "7px 12px",
    borderRadius: 8,
    background: t.SURFACE,
    border: `1px solid ${t.BORDER_SOLID}`,
    color: t.TITLE,
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
      <div style={{ fontSize: 12, color: t.MUTED }}>{summary}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" disabled={atStart} onClick={() => onPageChange(page - 1)} style={buttonStyle(atStart)}>
          <ChevronLeft size={13} /> Previous
        </button>
        <span aria-live="polite" style={{ fontSize: 12, color: t.SUBTLE }}>
          Page {page + 1} of {pageCount}
        </span>
        <button type="button" disabled={atEnd} onClick={() => onPageChange(page + 1)} style={buttonStyle(atEnd)}>
          Next <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
