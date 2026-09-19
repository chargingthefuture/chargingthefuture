"use client";

import { useCallback, useEffect, useState } from "react";
import type { PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import { FiresideCommentEditor } from "./fireside-comment-editor";
import {
  FIRESIDE_REACTION_KINDS,
  FIRESIDE_REACTION_LABELS,
  FIRESIDE_VOTE_KINDS,
  FIRESIDE_VOTE_LABELS,
  firesidePostUrl,
} from "@/lib/fireside/constants";

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
  /** When the author last rewrote it, or null if they never did. Drives the "edited" mark. */
  editedAt: string | null;
  reactions: Record<string, number>;
  viewerReactions: string[];
  isOwn: boolean;
  /**
   * What is happening to this comment, for the person who wrote it. Null on everybody else's, so
   * the screen knows the state of its own reader's comments and nothing about anybody else's.
   */
  viewerState: "live" | "held_for_approval" | "removed" | "withdrawn" | null;
};

// What a member is told about their own comment where it sits in the conversation.
//
// Said here as well as on their own comments list, because this is the screen they are on when they
// write: a held comment that looks exactly like a live one tells somebody their words are public
// when they are not, and a removed one with nothing beside it reads as though it is still in the
// conversation everybody else is having. Nothing is shown on anybody else's comment — the server
// sends no state for those.
//
// The three colors are the ones the member's own comments list already labels these states with, so
// one state does not read as two different things on two screens.
const VIEWER_STATE_NOTE: Record<
  NonNullable<ThreadComment["viewerState"]>,
  { text: string; color: string } | null
> = {
  live: null,
  held_for_approval: {
    text: "Only you can see this. It appears to everybody once your account is approved.",
    color: "#F59E0B",
  },
  removed: {
    text: "An admin took this down. Only you can see it, and putting it back is theirs to do.",
    color: "#F87171",
  },
  withdrawn: { text: "You took this down.", color: "#94A3B8" },
};

function ViewerStateNote({ comment }: { comment: ThreadComment }) {
  const note = comment.viewerState ? VIEWER_STATE_NOTE[comment.viewerState] : null;
  if (!note) return null;
  return (
    <div style={{ fontSize: 13, color: note.color, lineHeight: 1.6, marginTop: 6 }}>{note.text}</div>
  );
}

// A comment's words, or the box its author is rewriting them in.
//
// The "edited" mark is the whole reason the mark exists: a rewritten comment keeps its id, its
// replies and its reactions, so without it a reader has no way to tell that what they are reading
// is not what was answered. The Commons marks a rewritten reply the same way.
function CommentBody({
  comment,
  t,
  editing,
  busy,
  onSaveEdit,
  onCancelEdit,
}: {
  comment: ThreadComment;
  t: PluginShellTokens;
  editing: boolean;
  busy: boolean;
  onSaveEdit: (commentId: string, body: string) => void;
  onCancelEdit: () => void;
}) {
  if (editing) {
    return (
      <FiresideCommentEditor
        t={t}
        initialBody={comment.body}
        busy={busy}
        onSave={(body) => onSaveEdit(comment.id, body)}
        onCancel={onCancelEdit}
      />
    );
  }
  return (
    <>
      <div style={{ fontSize: 13, color: t.TEXT, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{comment.body}</div>
      {comment.editedAt && <div style={{ fontSize: 13, color: t.SUBTLE, marginTop: 4 }}>Edited</div>}
    </>
  );
}

// The author's way to fix their own words in place. Shown only on their own comments; what they may
// actually change, and what it costs a blog-export approval, is decided on the server.
//
// Not offered on a comment an admin removed or the author took down. The server refuses both, with
// a sentence saying whose decision it was — but it is a question the screen should not have had to
// ask, and a control that always fails is worse than no control. The member's own comments list has
// worked this way since it shipped; the thread could not, until the comment shape carried the state
// its own author is allowed to see.
function EditButton({
  comment,
  t,
  busy,
  onEdit,
}: {
  comment: ThreadComment;
  t: PluginShellTokens;
  busy: boolean;
  onEdit: (commentId: string) => void;
}) {
  if (!comment.isOwn) return null;
  if (comment.viewerState === "removed" || comment.viewerState === "withdrawn") return null;
  return (
    <button type="button" disabled={busy} onClick={() => onEdit(comment.id)}
      style={{ background: "transparent", border: "none", color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", padding: 0 }}>
      Edit
    </button>
  );
}

// Agree and disagree.
//
// Two things about them are deliberate and should not be "improved" later without asking. Neither
// moves the comment — the thread is oldest first, and nothing anywhere reads a count to decide
// position, which is the inversion of the platform this exists as an alternative to. And the
// disagree count is not shown, to anybody: the press is recorded, the person who left it sees
// their own, and no total appears on any screen (owner decision, 2026-09-14). The server does not
// return that total either, so this is not the only thing standing between it and a reader.
function Votes({
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
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {FIRESIDE_VOTE_KINDS.map((kind) => {
        const mine = comment.viewerReactions.includes(kind);
        // Only `upvote` is ever in the counts the server sends; `downvote` has no key there.
        const count = kind === "upvote" ? comment.reactions?.upvote ?? 0 : null;
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
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {FIRESIDE_VOTE_LABELS[kind]}
            {count != null && count > 0 ? ` · ${count}` : ""}
          </button>
        );
      })}
    </div>
  );
}

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
              fontSize: 13,
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
        <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 6 }}>
          Replying to a comment.{" "}
          <button type="button" onClick={onCancelReply}
            style={{ background: "transparent", border: "none", color: t.ACCENT, fontSize: 13, cursor: "pointer", padding: 0 }}>
            Cancel
          </button>
        </div>
      )}
      <textarea
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        placeholder="Say something about this post"
        rows={4}
        style={{ width: "100%", boxSizing: "border-box", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 12, fontSize: 15, color: t.TEXT, lineHeight: 1.6 }}
      />
      <button type="button" disabled={busy || empty} onClick={onPost}
        style={{ marginTop: 8, background: t.ACCENT, color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 15, fontWeight: 600, cursor: busy || empty ? "default" : "pointer", opacity: busy || empty ? 0.5 : 1 }}>
        {busy ? "Posting…" : "Post"}
      </button>
    </div>
  );
}

// The comments themselves, top level with their replies under them. Its own component purely so
// FiresideThreadView stays inside the rule-116 length budget; it holds no state of its own.
function ThreadComments({
  comments,
  loading,
  isAdmin,
  t,
  busy,
  editingId,
  onReact,
  onReply,
  onRemove,
  onEdit,
  onSaveEdit,
  onCancelEdit,
}: {
  comments: ThreadComment[];
  loading: boolean;
  isAdmin: boolean;
  t: PluginShellTokens;
  busy: boolean;
  /** Which comment the author has open for rewriting, if any. */
  editingId: string | null;
  onReact: (commentId: string, kind: string) => void;
  onReply: (commentId: string) => void;
  onRemove: (commentId: string) => void;
  onEdit: (commentId: string) => void;
  onSaveEdit: (commentId: string, body: string) => void;
  onCancelEdit: () => void;
}) {
  if (loading) return <div style={{ fontSize: 13, color: t.SUBTLE }}>Loading…</div>;

  // A reply whose parent is not on this screen still gets read.
  //
  // The comment it answers can be gone in two ways: its author took it down, which drops it from
  // the conversation entirely, or an admin removed it, which leaves it visible to its own author
  // and to nobody else. The reply itself is untouched by either — it is still there, still public,
  // and the route still returns it. Filing it only under a parent that is not in the list rendered
  // it nowhere, so one comment being taken out quietly took every answer to it out as well, and the
  // people who wrote those answers saw their own words vanish from the thread.
  const present = new Set(comments.map((comment) => comment.id));
  const isOrphan = (comment: ThreadComment) =>
    comment.parentCommentId != null && !present.has(comment.parentCommentId);
  const top = comments.filter((comment) => comment.parentCommentId == null || isOrphan(comment));
  if (top.length === 0) {
    return <div style={{ fontSize: 13, color: t.SUBTLE, padding: "16px 0" }}>Nothing here yet. Say the first thing.</div>;
  }

  return (
    <>
      {top.map((comment) => (
        <div key={comment.id} style={{ marginBottom: 16 }}>
          <div style={{ background: t.SURFACE, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 6 }}>{comment.authorName}</div>
            {isOrphan(comment) && (
              <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 6, lineHeight: 1.6 }}>
                Answering a comment that is no longer shown here.
              </div>
            )}
            <CommentBody comment={comment} t={t} editing={editingId === comment.id} busy={busy}
              onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit} />
            <ViewerStateNote comment={comment} />
            <Votes comment={comment} t={t} onReact={onReact} busy={busy} />
            <Reactions comment={comment} t={t} onReact={onReact} busy={busy} />
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button type="button" onClick={() => onReply(comment.id)}
                style={{ background: "transparent", border: "none", color: t.SUBTLE, fontSize: 13, cursor: "pointer", padding: 0 }}>
                Reply
              </button>
              {editingId !== comment.id && (
                <EditButton comment={comment} t={t} busy={busy} onEdit={onEdit} />
              )}
              {isAdmin && !comment.isOwn && (
                <button type="button" disabled={busy} onClick={() => onRemove(comment.id)}
                  style={{ background: "transparent", border: "none", color: "#F87171", fontSize: 13, cursor: busy ? "default" : "pointer", padding: 0 }}>
                  Remove
                </button>
              )}
            </div>
          </div>
          {comments.filter((reply) => reply.parentCommentId === comment.id).map((reply) => (
            <div key={reply.id} style={{ marginLeft: 16, marginTop: 8, background: t.SURFACE, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 6 }}>{reply.authorName}</div>
              <CommentBody comment={reply} t={t} editing={editingId === reply.id} busy={busy}
                onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit} />
              <ViewerStateNote comment={reply} />
              <Votes comment={reply} t={t} onReact={onReact} busy={busy} />
              <Reactions comment={reply} t={t} onReact={onReact} busy={busy} />
              {editingId !== reply.id && (
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <EditButton comment={reply} t={t} busy={busy} onEdit={onEdit} />
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// Whether this conversation is still open, and an admin's control over that.
//
// Closing is not removing. Everything written stays where it is and stays readable — it says the
// talking is done, not that the talk was wrong, which is why the line a member reads says so
// plainly rather than leaving them to guess what happened.
function ThreadState({
  thread,
  isAdmin,
  t,
  busy,
  onSetClosed,
}: {
  thread: { id: string; isClosed: boolean } | null;
  isAdmin: boolean;
  t: PluginShellTokens;
  busy: boolean;
  onSetClosed: (next: boolean) => void;
}) {
  if (!thread) return null;
  return (
    <>
      {thread.isClosed && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER}`, fontSize: 13, color: t.SUBTLE, lineHeight: 1.6 }}>
          This conversation is closed to new comments. Everything already written stays here and
          stays readable.
        </div>
      )}
      {isAdmin && (
        <button type="button" disabled={busy} onClick={() => onSetClosed(!thread.isClosed)}
          style={{ background: "transparent", border: `1px solid ${t.BORDER}`, borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: t.SUBTLE, cursor: busy ? "default" : "pointer", marginBottom: 12 }}>
          {thread.isClosed ? "Open this conversation again" : "Close this conversation to new comments"}
        </button>
      )}
    </>
  );
}

/**
 * Send one write and read the answer.
 *
 * Module-level rather than inside the view, so the screen's own function stays inside the rule-116
 * length budget. Whether it worked is `res.ok` and never whether a body parsed — a change that
 * saved must not read as a failure because something in front of the app answered with a page — and
 * a refusal is raised with the sentence the server wrote, which is the one that names what to do
 * about it (rule 137).
 */
async function sendWrite(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
  failure: string,
): Promise<{ message?: string; notice?: string | null }> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; notice?: string | null };
  if (!res.ok) throw new Error(data.message ?? failure);
  return data;
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
  const [thread, setThread] = useState<{ id: string; isClosed: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  // Which of the member's own comments is open for rewriting. One at a time, so an unsaved draft is
  // never left behind on a comment that has scrolled away.
  const [editingId, setEditingId] = useState<string | null>(null);
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
      const data = (await res.json()) as {
        comments: ThreadComment[];
        thread: { id: string; isClosed: boolean } | null;
      };
      setComments(data.comments);
      setThread(data.thread);
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
      const data = await sendWrite(
        "/api/fireside/comments",
        "POST",
        { postRepo, postSlug, postTitle, parentCommentId: replyTo, body: draft },
        "Could not post that.",
      );
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

  /**
   * The author rewrites their own comment, in place.
   *
   * The comment keeps its id, so the replies under it and the reactions on it stay where they are.
   * Fixing a typo used to mean taking the comment down and writing it again, which loses all of
   * that (owner report, 2026-09-17).
   */
  async function saveEdit(commentId: string, body: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const failure = "Could not save that change.";
      const data = await sendWrite(`/api/fireside/comments/${commentId}`, "PATCH", { body }, failure);
      // An approval an admin gave to the old wording does not carry over, and the author is told so
      // here rather than finding the switch moved later.
      if (data.notice) setNotice(data.notice);
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that change.");
    } finally {
      setBusy(false);
    }
  }

  async function react(commentId: string, kind: string) {
    setBusy(true);
    try {
      const failure = "Could not record that reaction.";
      await sendWrite(`/api/fireside/comments/${commentId}/reactions`, "POST", { kind }, failure);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record that reaction.");
    } finally {
      setBusy(false);
    }
  }

  async function setClosed(next: boolean) {
    if (!thread) return;
    setBusy(true);
    setError(null);
    try {
      const failure = "Could not change whether this conversation is open.";
      const payload = { isClosed: next, reason: "Set from the thread view." };
      await sendWrite(`/api/fireside/admin/threads/${thread.id}`, "POST", payload, failure);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change whether this conversation is open.");
    } finally {
      setBusy(false);
    }
  }

  async function moderate(commentId: string) {
    setBusy(true);
    try {
      const failure = "Could not remove that comment.";
      const payload = { action: "remove", reason: "Removed from the thread view." };
      await sendWrite(`/api/fireside/admin/comments/${commentId}`, "POST", payload, failure);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Back means the post for somebody who arrived from one — they were reading it a moment ago,
          and they may have written nothing here, so a list of their own comments is an empty room. */}
      {cameFromPost ? (
        <a href={firesidePostUrl(postRepo, postSlug)}
          style={{ display: "inline-block", color: t.ACCENT, fontSize: 14, fontWeight: 600, textDecoration: "none", padding: "0 0 12px" }}>
          ‹ Back to the post
        </a>
      ) : (
        <button type="button" onClick={onClose}
          style={{ background: "transparent", border: "none", color: t.ACCENT, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "0 0 12px" }}>
          ‹ Back to your comments
        </button>
      )}
      <h2 style={{ fontSize: 15, fontWeight: 600, color: t.TEXT, margin: "0 0 14px" }}>{postTitle || postSlug}</h2>

      <ThreadState thread={thread} isAdmin={isAdmin} t={t} busy={busy} onSetClosed={(next) => void setClosed(next)} />

      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 15, color: "#F87171" }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 15, color: "#F59E0B", lineHeight: 1.6 }}>
          {notice}
        </div>
      )}

      <ThreadComments
        comments={comments}
        loading={loading}
        isAdmin={isAdmin}
        t={t}
        busy={busy}
        editingId={editingId}
        onReact={(id, kind) => void react(id, kind)}
        onReply={setReplyTo}
        onRemove={(id) => void moderate(id)}
        onEdit={(id) => { setNotice(null); setEditingId(id); }}
        onSaveEdit={(id, body) => void saveEdit(id, body)}
        onCancelEdit={() => setEditingId(null)}
      />

      {!thread?.isClosed && (
        <Composer
          t={t}
          draft={draft}
          onDraft={setDraft}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          busy={busy}
          onPost={() => void post()}
        />
      )}
    </div>
  );
}
