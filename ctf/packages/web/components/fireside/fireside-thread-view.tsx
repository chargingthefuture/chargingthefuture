"use client";

import { useCallback, useEffect, useState } from "react";
import type { PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import { FIRESIDE_REACTION_KINDS, FIRESIDE_REACTION_LABELS, firesidePostUrl } from "@/lib/fireside/constants";

// One post's conversation, opened from inside the app. The same data the blog widget will show, on
// the screen a member already has.
//
// This is not the browse-every-conversation view, which is tabled (owner decision, 2026-09-13). It
// opens one thread a member is already part of, so they can read the replies and answer without
// leaving for the blog and back.

type ThreadComment = {
  id: string;
  parentCommentId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
  reactions: Record<string, number>;
  viewerReactions: string[];
  isOwn: boolean;
};

function Reactions({
  comment,
  t,
  onReact,
  busy,
}: {
  comment: ThreadComment;
  t: PluginShellTokens;
  onReact: (commentId: string, kind: string) => void;
  busy: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      {FIRESIDE_REACTION_KINDS.map((kind) => {
        const mine = comment.viewerReactions.includes(kind);
        const count = comment.reactions?.[kind] ?? 0;
        return (
          <button
            key={kind}
            type="button"
            disabled={busy}
            onClick={() => onReact(comment.id, kind)}
            aria-pressed={mine}
            style={{
              background: mine ? `${t.ACCENT}22` : "transparent",
              border: `1px solid ${mine ? t.ACCENT : t.BORDER}`,
              color: mine ? t.ACCENT : t.SUBTLE,
              borderRadius: 20,
              padding: "3px 10px",
              fontSize: 11,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {FIRESIDE_REACTION_LABELS[kind]}{count > 0 ? ` · ${count}` : ""}
          </button>
        );
      })}
    </div>
  );
}

// The box you write in. Its own component so the thread view stays inside the complexity budget
// (rule 116) rather than carrying the list, the replies and the form in one function.
function Composer({
  t,
  draft,
  onDraft,
  replyTo,
  onCancelReply,
  busy,
  onPost,
}: {
  t: PluginShellTokens;
  draft: string;
  onDraft: (value: string) => void;
  replyTo: string | null;
  onCancelReply: () => void;
  busy: boolean;
  onPost: () => void;
}) {
  const empty = draft.trim().length === 0;
  return (
    <div style={{ marginTop: 20 }}>
      {replyTo && (
        <div style={{ fontSize: 11, color: t.SUBTLE, marginBottom: 6 }}>
          Replying to a comment.{" "}
          <button type="button" onClick={onCancelReply}
            style={{ background: "transparent", border: "none", color: t.ACCENT, fontSize: 11, cursor: "pointer", padding: 0 }}>
            Cancel
          </button>
        </div>
      )}
      <textarea
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        placeholder="Say something about this post"
        rows={4}
        style={{ width: "100%", boxSizing: "border-box", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 12, fontSize: 13, color: t.TEXT, lineHeight: 1.6 }}
      />
      <button type="button" disabled={busy || empty} onClick={onPost}
        style={{ marginTop: 8, background: t.ACCENT, color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: busy || empty ? "default" : "pointer", opacity: busy || empty ? 0.5 : 1 }}>
        {busy ? "Posting…" : "Post"}
      </button>
    </div>
  );
}

export function FiresideThreadView({
  postRepo,
  postSlug,
  postTitle,
  isAdmin,
  t,
  onClose,
  cameFromPost = false,
}: {
  postRepo: string;
  postSlug: string;
  postTitle: string;
  isAdmin: boolean;
  t: PluginShellTokens;
  onClose: () => void;
  /** True when a link from the post opened this, rather than the member's own comment list. */
  cameFromPost?: boolean;
}) {
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fireside/threads?repo=${encodeURIComponent(postRepo)}&slug=${encodeURIComponent(postSlug)}`);
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Could not load this conversation.");
      }
      const data = (await res.json()) as { comments: ThreadComment[] };
      setComments(data.comments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this conversation.");
    } finally {
      setLoading(false);
    }
  }, [postRepo, postSlug]);

  useEffect(() => { void load(); }, [load]);

  async function post() {
    if (busy || draft.trim().length === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/fireside/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ postRepo, postSlug, postTitle, parentCommentId: replyTo, body: draft }),
      });
      const data = (await res.json()) as { message?: string; notice?: string | null };
      if (!res.ok) throw new Error(data.message ?? "Could not post that.");
      setDraft("");
      setReplyTo(null);
      // The held notice is shown at the moment of posting, never left to be discovered.
      if (data.notice) setNotice(data.notice);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post that.");
    } finally {
      setBusy(false);
    }
  }

  async function react(commentId: string, kind: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/fireside/comments/${commentId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Could not record that reaction.");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record that reaction.");
    } finally {
      setBusy(false);
    }
  }

  async function moderate(commentId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/fireside/admin/comments/${commentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ action: "remove", reason: "Removed from the thread view." }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Could not remove that comment.");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that comment.");
    } finally {
      setBusy(false);
    }
  }

  const top = comments.filter((c) => c.parentCommentId == null);

  return (
    <div>
      {/* Back means the post for somebody who arrived from one — they were reading it a moment ago,
          and they may have written nothing here, so a list of their own comments is an empty room. */}
      {cameFromPost ? (
        <a href={firesidePostUrl(postRepo, postSlug)}
          style={{ display: "inline-block", color: t.ACCENT, fontSize: 12, fontWeight: 600, textDecoration: "none", padding: "0 0 12px" }}>
          ‹ Back to the post
        </a>
      ) : (
        <button type="button" onClick={onClose}
          style={{ background: "transparent", border: "none", color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "0 0 12px" }}>
          ‹ Back to your comments
        </button>
      )}
      <h2 style={{ fontSize: 15, fontWeight: 600, color: t.TEXT, margin: "0 0 14px" }}>{postTitle || postSlug}</h2>

      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 13, color: "#EF4444" }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#F59E0B", lineHeight: 1.6 }}>
          {notice}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: t.SUBTLE }}>Loading…</div>
      ) : top.length === 0 ? (
        <div style={{ fontSize: 13, color: t.SUBTLE, padding: "16px 0" }}>Nothing here yet. Say the first thing.</div>
      ) : (
        top.map((comment) => (
          <div key={comment.id} style={{ marginBottom: 16 }}>
            <div style={{ background: t.SURFACE, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: t.SUBTLE, marginBottom: 6 }}>{comment.authorName}</div>
              <div style={{ fontSize: 13, color: t.TEXT, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{comment.body}</div>
              <Reactions comment={comment} t={t} onReact={(id, kind) => void react(id, kind)} busy={busy} />
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setReplyTo(comment.id)}
                  style={{ background: "transparent", border: "none", color: t.SUBTLE, fontSize: 11, cursor: "pointer", padding: 0 }}>
                  Reply
                </button>
                {isAdmin && !comment.isOwn && (
                  <button type="button" disabled={busy} onClick={() => void moderate(comment.id)}
                    style={{ background: "transparent", border: "none", color: "#EF4444", fontSize: 11, cursor: busy ? "default" : "pointer", padding: 0 }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            {comments.filter((reply) => reply.parentCommentId === comment.id).map((reply) => (
              <div key={reply.id} style={{ marginLeft: 16, marginTop: 8, background: t.SURFACE, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: t.SUBTLE, marginBottom: 6 }}>{reply.authorName}</div>
                <div style={{ fontSize: 13, color: t.TEXT, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{reply.body}</div>
                <Reactions comment={reply} t={t} onReact={(id, kind) => void react(id, kind)} busy={busy} />
              </div>
            ))}
          </div>
        ))
      )}

      <Composer
        t={t}
        draft={draft}
        onDraft={setDraft}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        busy={busy}
        onPost={() => void post()}
      />
    </div>
  );
}
