"use client";

import { useCallback, useEffect, useState } from "react";
import type { PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import { firesidePostUrl } from "@/lib/fireside/constants";
import { Pager } from "./fireside-pager";
import { useUrlPage } from "./fireside-url-page";

// Every conversation, and the one control that acts on an entire one: close it to new comments, or
// open it again.
//
// The control itself is not new — it has been on the thread under each post since the plugin
// shipped. What was missing is the list: reaching it meant opening the right post, which means
// already knowing which post, and with hundreds of posts on the blog that is not a thing anybody
// can do at the moment they need to.
//
// Closing is not removing, and the screen says so. Everything already written stays where it is and
// stays readable by anybody; only new comments are refused.

type AdminThread = {
  id: string;
  postRepo: string;
  postSlug: string;
  postTitle: string;
  isClosed: boolean;
  commentCount: number;
  hiddenCount: number;
  lastCommentAt: string | null;
};

// What is in this conversation, counted. The hidden tally is said out loud rather than folded into
// the total: a thread reading "0 comments" when three were taken out of it looks like a thread
// nobody wrote in, which is the opposite of what happened.
function CountLine({ thread, t }: { thread: AdminThread; t: PluginShellTokens }) {
  return (
    <div style={{ fontSize: 13, color: t.SUBTLE, marginTop: 6, lineHeight: 1.6 }}>
      {thread.commentCount} comment{thread.commentCount === 1 ? "" : "s"}
      {thread.hiddenCount > 0 && ` · ${thread.hiddenCount} removed or taken down`}
      {thread.lastCommentAt && ` · last one ${new Date(thread.lastCommentAt).toLocaleString()}`}
    </div>
  );
}

function ThreadRow({
  thread,
  t,
  busy,
  onSetClosed,
}: {
  thread: AdminThread;
  t: PluginShellTokens;
  busy: boolean;
  onSetClosed: (id: string, isClosed: boolean) => void;
}) {
  return (
    <div style={{ background: t.SURFACE, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <a href={firesidePostUrl(thread.postRepo, thread.postSlug)} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 15, color: t.ACCENT, textDecoration: "none", minWidth: 0 }}>
          {thread.postTitle || thread.postSlug}
        </a>
        <span style={{ fontSize: 13, fontWeight: 600, color: thread.isClosed ? "#F59E0B" : "#10B981", flexShrink: 0 }}>
          {thread.isClosed ? "Closed" : "Open"}
        </span>
      </div>
      <CountLine thread={thread} t={t} />
      <button type="button" disabled={busy} onClick={() => onSetClosed(thread.id, !thread.isClosed)}
        style={{ background: "transparent", border: "none", color: thread.isClosed ? t.ACCENT : "#F59E0B", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", padding: 0, marginTop: 12 }}>
        {thread.isClosed ? "Open it to new comments" : "Close it to new comments"}
      </button>
    </div>
  );
}

export function FiresideAdminThreads({ t }: { t: PluginShellTokens }) {
  const [page, setPage] = useUrlPage("threads");
  const [threads, setThreads] = useState<AdminThread[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (wanted: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fireside/admin/threads?page=${wanted}`);
      const data = (await res.json()) as {
        message?: string;
        threads?: AdminThread[];
        page?: number;
        lastPage?: number;
        total?: number;
      };
      if (!res.ok) throw new Error(data.message ?? "Could not load the conversations.");
      setThreads(data.threads ?? []);
      setLastPage(data.lastPage ?? 1);
      setTotal(data.total ?? 0);
      // The server clamps an out-of-range page and answers with the one it used, so a linked page
      // number past the end lands on the last page rather than on nothing.
      if (data.page && data.page !== wanted) setPage(data.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the conversations.");
    } finally {
      setLoading(false);
    }
  }, [setPage]);

  useEffect(() => { void load(page); }, [load, page]);

  async function setClosed(id: string, isClosed: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/fireside/admin/threads/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ isClosed, reason: "From the conversations list." }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Could not change that conversation.");
      }
      await load(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change that conversation.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: t.TEXT, margin: "0 0 6px" }}>Conversations</h2>
      <p style={{ fontSize: 15, color: t.TEXT, lineHeight: 1.7, marginTop: 0 }}>
        One per post that somebody has commented under, the most recent first. Closing a conversation
        refuses new comments and touches nothing already written — everything under it stays there and
        stays readable by anybody. It can be opened again from the same control.
      </p>

      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 15, color: "#F87171" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 15, color: t.SUBTLE }}>Loading…</div>
      ) : threads.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: t.SUBTLE, fontSize: 15, lineHeight: 1.7 }}>
          No conversations yet.
          <br />
          One starts the first time somebody comments under a post, so there is nothing to list until
          then — a post nobody has written under has no row here.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 10 }}>
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </div>
          {threads.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} t={t} busy={busyId === thread.id}
              onSetClosed={(id, isClosed) => void setClosed(id, isClosed)} />
          ))}
          <Pager page={page} lastPage={lastPage} t={t} onPage={setPage} />
        </>
      )}
    </div>
  );
}
