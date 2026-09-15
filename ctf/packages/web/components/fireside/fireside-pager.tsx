"use client";

import type { PluginShellTokens } from "@/components/shared/plugin-shell-theme";

// Paged, never an endless list — accessibility rule. Its own component so the shell stays inside
// the complexity budget (rule 116); the four disabled and dimmed states were most of it.
export function Pager({
  page,
  lastPage,
  t,
  onPage,
}: {
  page: number;
  lastPage: number;
  t: PluginShellTokens;
  onPage: (next: number) => void;
}) {
  const atStart = page <= 1;
  const atEnd = page >= lastPage;
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
      <button type="button" disabled={atStart} onClick={() => onPage(page - 1)}
        style={{ background: "transparent", border: `1px solid ${t.BORDER}`, borderRadius: 8, padding: "6px 12px", fontSize: 14, color: t.TEXT, cursor: atStart ? "default" : "pointer", opacity: atStart ? 0.4 : 1 }}>
        Previous
      </button>
      <span style={{ fontSize: 14, color: t.SUBTLE, alignSelf: "center" }}>Page {page} of {lastPage}</span>
      <button type="button" disabled={atEnd} onClick={() => onPage(page + 1)}
        style={{ background: "transparent", border: `1px solid ${t.BORDER}`, borderRadius: 8, padding: "6px 12px", fontSize: 14, color: t.TEXT, cursor: atEnd ? "default" : "pointer", opacity: atEnd ? 0.4 : 1 }}>
        Next
      </button>
    </div>
  );
}
