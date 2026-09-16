"use client";

import { useCallback, useEffect, useState } from "react";
import type { PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import { Pager } from "./fireside-pager";
import { useUrlPage } from "./fireside-url-page";

// The admin's half of the two keys on copying a comment out to the blog's published build.
//
// The author asking is the other half. Neither does anything alone, and this screen is where the
// second one is turned — or refused, which is final for that comment.
//
// Every row carries the author's record here, because the decision worth making is often not about
// the comment. An account with four removals and two refusals behind it is answered once, as an
// account, rather than chased item by item.

type AuthorRecord = {
  comments: number;
  removed: number;
  exportsRefused: number;
  exportsApproved: number;
};

type ExportRequest = {
  commentId: string;
  body: string;
  authorUserId: string;
  authorName: string;
  postSlug: string;
  postTitle: string;
  requestedAt: string;
  authorRecord: AuthorRecord;
};

/** Worth a second look when this account has been declined or taken down here before. */
function hasHistory(record: AuthorRecord): boolean {
  return record.removed > 0 || record.exportsRefused > 0;
}

function AuthorLine({ record, t }: { record: AuthorRecord; t: PluginShellTokens }) {
  const flagged = hasHistory(record);
  return (
    <div
      style={{
        fontSize: 13,
        lineHeight: 1.6,
        color: flagged ? "#F59E0B" : t.SUBTLE,
        background: flagged ? "rgba(245,158,11,0.08)" : "transparent",
        border: flagged ? "1px solid rgba(245,158,11,0.25)" : "1px solid transparent",
        borderRadius: 8,
        padding: flagged ? "8px 10px" : "0",
        marginTop: 10,
      }}
    >
      {record.comments} comment{record.comments === 1 ? "" : "s"} here · {record.removed} removed ·{" "}
      {record.exportsRefused} export{record.exportsRefused === 1 ? "" : "s"} declined ·{" "}
      {record.exportsApproved} approved
      {flagged && (
        <div style={{ marginTop: 6 }}>
          This account has been declined or taken down here before. Consider whether the account
          belongs here at all rather than deciding this one comment.
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  t,
  busy,
  onDecide,
}: {
  request: ExportRequest;
  t: PluginShellTokens;
  busy: boolean;
  onDecide: (commentId: string, action: "approve" | "refuse") => void;
}) {
  return (
    <div style={{ background: t.SURFACE, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 6 }}>
        {request.authorName} · under {request.postTitle || request.postSlug}
      </div>
      <div style={{ fontSize: 15, color: t.TEXT, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{request.body}</div>
      <AuthorLine record={request.authorRecord} t={t} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide(request.commentId, "approve")}
          style={{ background: t.ACCENT, color: "#000", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}
        >
          Approve for the blog
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide(request.commentId, "refuse")}
          style={{ background: "transparent", color: "#F87171", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, padding: "7px 14px", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

export function FiresideExportQueue({ t }: { t: PluginShellTokens }) {
  // The page is in the address bar, so a queue page can be linked and the back button works
  // (rule 100). It used to be local state here, which is the gap the inventory recorded.
  const [page, setPage] = useUrlPage("queue");
  const [requests, setRequests] = useState<ExportRequest[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (wanted: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fireside/admin/export-queue?page=${wanted}`);
      const data = (await res.json()) as {
        message?: string;
        requests?: ExportRequest[];
        page?: number;
        lastPage?: number;
        total?: number;
      };
      if (!res.ok) throw new Error(data.message ?? "Could not load the export queue.");
      setRequests(data.requests ?? []);
      setLastPage(data.lastPage ?? 1);
      setTotal(data.total ?? 0);
      // The server clamps an out-of-range page and answers with the one it used, so a linked page
      // number past the end lands on the last page rather than on nothing — which is what a
      // bookmarked queue page does as soon as the queue drains.
      if (data.page && data.page !== wanted) setPage(data.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the export queue.");
    } finally {
      setLoading(false);
    }
  }, [setPage]);

  useEffect(() => { void load(page); }, [load, page]);

  async function decide(commentId: string, action: "approve" | "refuse") {
    setBusyId(commentId);
    setError(null);
    try {
      const res = await fetch(`/api/fireside/admin/export-queue/${commentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          action,
          reason: action === "refuse" ? "Declined for the published blog build." : "",
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Could not record that decision.");
      }
      await load(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record that decision.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: t.TEXT, margin: "0 0 6px" }}>Blog export queue</h2>
      <p style={{ fontSize: 15, color: t.TEXT, lineHeight: 1.7, marginTop: 0 }}>
        Comments whose authors asked for them to be copied into the blog&rsquo;s published build.
        That page is captured by a web archive and cannot be pulled back afterwards, so nothing
        leaves the app until you agree here. Declining is final for that comment.
      </p>

      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 15, color: "#F87171" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 15, color: t.SUBTLE }}>Loading…</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: t.SUBTLE, fontSize: 15, lineHeight: 1.6 }}>
          Nothing waiting.
          <br />
          A request appears here when a member asks for one of their comments to go into the blog.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 10 }}>
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </div>
          {requests.map((request) => (
            <RequestCard
              key={request.commentId}
              request={request}
              t={t}
              busy={busyId === request.commentId}
              onDecide={(id, action) => void decide(id, action)}
            />
          ))}
          <Pager page={page} lastPage={lastPage} t={t} onPage={setPage} />
        </>
      )}
    </div>
  );
}
