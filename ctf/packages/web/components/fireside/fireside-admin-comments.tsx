"use client";

import { useCallback, useEffect, useState } from "react";
import type { PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import { firesidePostUrl } from "@/lib/fireside/constants";
import { Pager } from "./fireside-pager";
import { useUrlPage } from "./fireside-url-page";

// Every comment, newest first, for an admin to work through.
//
// The export queue answers one question — may this go on the blog. This is the other half of
// moderation, which until now meant knowing a comment's id and calling the route by hand.
//
// Removed and withdrawn rows are listed alongside live ones on purpose: a list that hides what was
// already acted on cannot be used to undo anything, and undoing is most of what this is for. A
// withdrawn comment is the one thing here nobody can put back, so it carries no control.

type AdminComment = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  postRepo: string;
  postSlug: string;
  postTitle: string;
  state: "live" | "held_for_approval" | "removed" | "withdrawn";
};

const STATE_LABEL: Record<AdminComment["state"], string> = {
  live: "Live",
  held_for_approval: "Held until the author is approved",
  removed: "Removed by an admin",
  withdrawn: "Taken down by its author",
};

const STATE_COLOR: Record<AdminComment["state"], string> = {
  live: "#10B981",
  held_for_approval: "#F59E0B",
  removed: "#F87171",
  withdrawn: "#94A3B8",
};

function Row({
  comment,
  t,
  busy,
  onModerate,
}: {
  comment: AdminComment;
  t: PluginShellTokens;
  busy: boolean;
  onModerate: (id: string, action: "remove" | "restore") => void;
}) {
  return (
    <div style={{ background: t.SURFACE, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
        <a href={firesidePostUrl(comment.postRepo, comment.postSlug)} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 14, color: t.ACCENT, textDecoration: "none", minWidth: 0 }}>
          {comment.postTitle || comment.postSlug}
        </a>
        <span style={{ fontSize: 13, fontWeight: 600, color: STATE_COLOR[comment.state], flexShrink: 0 }}>
          {STATE_LABEL[comment.state]}
        </span>
      </div>
      <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 6 }}>{comment.authorName}</div>
      <div style={{ fontSize: 15, color: t.TEXT, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
        {comment.body || <em style={{ color: t.SUBTLE }}>The author took this down. Nothing to moderate.</em>}
      </div>
      {comment.state === "removed" && (
        <button type="button" disabled={busy} onClick={() => onModerate(comment.id, "restore")}
          style={{ background: "transparent", border: "none", color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", padding: 0, marginTop: 12 }}>
          Put it back
        </button>
      )}
      {(comment.state === "live" || comment.state === "held_for_approval") && (
        <button type="button" disabled={busy} onClick={() => onModerate(comment.id, "remove")}
          style={{ background: "transparent", border: "none", color: "#F87171", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", padding: 0, marginTop: 12 }}>
          Remove
        </button>
      )}
    </div>
  );
}

export function FiresideAdminComments({ t, onClose }: { t: PluginShellTokens; onClose: () => void }) {
  const [page, setPage] = useUrlPage("comments");
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (wanted: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fireside/admin/comments?page=${wanted}`);
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Could not load recent comments.");
      }
      const data = (await res.json()) as {
        comments: AdminComment[];
        page: number;
        lastPage: number;
        total: number;
      };
      setComments(data.comments);
      setLastPage(data.lastPage);
      setTotal(data.total);
      // The server clamps an out-of-range page and answers with the one it used, so a linked page
      // number past the end lands on the last page rather than on nothing.
      if (data.page !== wanted) setPage(data.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load recent comments.");
    } finally {
      setLoading(false);
    }
  }, [setPage]);

  useEffect(() => { void load(page); }, [load, page]);

  async function moderate(id: string, action: "remove" | "restore") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/fireside/admin/comments/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ action, reason: "From the recent comments list." }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Could not change that comment.");
      }
      await load(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change that comment.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <button type="button" onClick={onClose}
        style={{ background: "transparent", border: "none", color: t.ACCENT, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "0 0 12px" }}>
        ‹ Back to your comments
      </button>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: t.TEXT, margin: "0 0 6px" }}>Recent comments</h2>
      <p style={{ fontSize: 15, color: t.TEXT, lineHeight: 1.7, marginTop: 0 }}>
        Everything written here, newest first, including what has already been removed or taken
        down. Removing a comment also cancels any request to publish it with the post.
      </p>

      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 15, color: "#F87171" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 15, color: t.SUBTLE }}>Loading…</div>
      ) : comments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: t.SUBTLE, fontSize: 15, lineHeight: 1.7 }}>
          Nobody has written anything here yet.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 10 }}>
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </div>
          {comments.map((comment) => (
            <Row key={comment.id} comment={comment} t={t} busy={busyId === comment.id}
              onModerate={(id, action) => void moderate(id, action)} />
          ))}
          <Pager page={page} lastPage={lastPage} t={t} onPage={setPage} />
        </>
      )}
    </div>
  );
}
