"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { MobileScreenHeader } from "@/components/shared/mobile-screen-header";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import { FIRESIDE_BLOG_BASE } from "@/lib/fireside/constants";
import { getAppAccent } from "@/lib/theme/theme-tokens";
import { FiresideAdminComments } from "./fireside-admin-comments";
import { FiresideExportQueue } from "./fireside-export-queue";
import { Pager } from "./fireside-pager";
import { FiresideThreadView } from "./fireside-thread-view";

// What a member manages about their own part in Fireside. Reading and writing happen under the blog
// post itself, which is where the conversation is; this screen is where somebody sees everything
// they have written in one place, what state each comment is in, and whether they have let any of
// it be copied into the blog's published build.
//
// The browse-every-conversation view is deliberately not here (owner decision, 2026-09-13): it is
// the same data in a different shape and it is tabled until the conversation exists to browse.

type OwnComment = {
  id: string;
  body: string;
  createdAt: string;
  postTitle: string;
  postSlug: string;
  postRepo: string;
  state: "live" | "held_for_approval" | "removed" | "withdrawn";
  exportToBlog: boolean;
  exportReview: "not_requested" | "pending" | "approved" | "refused";
  exportRefusalReason: string | null;
};

// What the author is told about their own export request. The switch is one of two keys — an admin
// holds the other — so a member who turns it on is owed the state, not left assuming their words
// are already on their way to the blog.
const EXPORT_NOTE: Record<OwnComment["exportReview"], string | null> = {
  not_requested: null,
  pending: "Waiting on an admin to read it before anything is copied to the blog.",
  approved: "Approved for the blog. Switch this off any time before it is copied and it will not be.",
  refused: "An admin declined this one for the blog. It stays here in the conversation.",
};

const STATE_LABEL: Record<OwnComment["state"], string> = {
  live: "Live",
  held_for_approval: "Held until you are approved",
  removed: "Removed by an admin",
  withdrawn: "You took this down",
};

const STATE_COLOR: Record<OwnComment["state"], string> = {
  live: "#10B981",
  held_for_approval: "#F59E0B",
  removed: "#EF4444",
  withdrawn: "#94A3B8",
};

function Guidelines({ t }: { t: PluginShellTokens }) {
  return (
    <details style={{ marginBottom: 20 }}>
      <summary style={{ fontSize: 13, fontWeight: 600, color: t.TEXT, cursor: "pointer" }}>
        What this room is for
      </summary>
      <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.6, marginTop: 10 }}>
        <p style={{ marginTop: 0 }}>
          Fireside is conversation about trafficking and rebuilding, under the posts on the blog. It
          is not the Commons — that is where you ask about the app and get help using it.
        </p>
        <p>
          The Commons guidelines apply here too. Beyond them there are few rules on purpose: a
          conversation about what was done to people and what to do next does not survive being
          tidied into a format, and a long list of rules is how that happens.
        </p>
        <p style={{ marginBottom: 0 }}>
          Anyone can read this without an account. Writing needs one, and what you write becomes
          public here once you are approved. Copying a comment onto the blog itself is a separate,
          stricter step: the author asks for it and an admin agrees, and neither one alone does it.
        </p>
      </div>
    </details>
  );
}

// The way to the conversation itself. Reading and writing happen under the posts on the blog, and
// this screen is only a member's own side of it — so without a link out, somebody who lands here
// with nothing written has no route to the thing the plugin is about except a search engine (owner
// report, 2026-09-14). It opens in a new tab so the member keeps their place in the app.
function BlogLink({ t, label }: { t: PluginShellTokens; label: string }) {
  return (
    <a
      href={FIRESIDE_BLOG_BASE}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-block",
        background: "transparent",
        border: `1px solid ${t.BORDER}`,
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 12,
        fontWeight: 600,
        color: t.ACCENT,
        textDecoration: "none",
      }}
    >
      {label}
    </a>
  );
}

// The export request and what state it is in. Its own component so CommentRow stays inside the
// complexity budget (rule 116), and because asking for a comment to go on the blog is a different
// decision from anything else on the row.
function ExportRequestRow({
  comment,
  t,
  busy,
  onToggleExport,
}: {
  comment: OwnComment;
  t: PluginShellTokens;
  busy: boolean;
  onToggleExport: (id: string, next: boolean) => void;
}) {
  const note = EXPORT_NOTE[comment.exportReview];
  const refused = comment.exportReview === "refused";
  return (
    <>
      <label style={{ fontSize: 11, color: t.SUBTLE, display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="checkbox"
          checked={comment.exportToBlog}
          disabled={busy || refused}
          onChange={(e) => onToggleExport(comment.id, e.target.checked)}
        />
        Ask for this to be published with the post
      </label>
      {note && (
        <div style={{ fontSize: 11, color: t.FAINT, lineHeight: 1.6, flexBasis: "100%" }}>
          {note}
          {refused && comment.exportRefusalReason ? ` ${comment.exportRefusalReason}` : ""}
        </div>
      )}
    </>
  );
}

function CommentRow({
  comment,
  t,
  onWithdraw,
  onToggleExport,
  onOpenThread,
  busyId,
}: {
  comment: OwnComment;
  t: PluginShellTokens;
  onWithdraw: (id: string) => void;
  onToggleExport: (id: string, next: boolean) => void;
  onOpenThread: (comment: OwnComment) => void;
  busyId: string | null;
}) {
  const busy = busyId === comment.id;
  const editable = comment.state === "live" || comment.state === "held_for_approval";
  return (
    <div style={{ background: t.SURFACE, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
        <button type="button" onClick={() => onOpenThread(comment)}
          style={{ fontSize: 12, color: t.ACCENT, background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer", minWidth: 0 }}>
          {comment.postTitle || comment.postSlug}
        </button>
        <span style={{ fontSize: 10, fontWeight: 600, color: STATE_COLOR[comment.state], flexShrink: 0 }}>
          {STATE_LABEL[comment.state]}
        </span>
      </div>
      <div style={{ fontSize: 13, color: t.TEXT, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {comment.body || <em style={{ color: t.FAINT }}>Withdrawn.</em>}
      </div>
      {editable && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <ExportRequestRow comment={comment} t={t} busy={busy} onToggleExport={onToggleExport} />
          <button
            type="button"
            onClick={() => onWithdraw(comment.id)}
            disabled={busy}
            style={{ background: "transparent", border: "none", color: "#EF4444", fontSize: 11, fontWeight: 600, cursor: busy ? "default" : "pointer", padding: 0 }}
          >
            Take it down
          </button>
        </div>
      )}
    </div>
  );
}

export function FiresideShell({
  isAdmin = false,
  initialPost = null,
}: {
  isAdmin?: boolean;
  /** A conversation named by the link that brought the member here, from a blog post. */
  initialPost?: { repo: string; slug: string; title: string } | null;
}) {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent("fireside", theme), theme);
  const [comments, setComments] = useState<OwnComment[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openPost, setOpenPost] = useState<{ repo: string; slug: string; title: string } | null>(
    initialPost,
  );
  // Whether the open thread is the one the link named. It stops being true the moment the member
  // navigates within the app, so "back" keeps meaning the place they actually came from.
  const [cameFromPost, setCameFromPost] = useState(initialPost != null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [adminListOpen, setAdminListOpen] = useState(false);

  const load = useCallback(async (wanted: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fireside/mine?page=${wanted}`);
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? "Could not load your comments.");
      }
      const data = (await res.json()) as { comments: OwnComment[]; page: number; lastPage: number; total: number };
      setComments(data.comments);
      setPage(data.page);
      setLastPage(data.lastPage);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your comments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1); }, [load]);

  async function send(id: string, init: RequestInit, failure: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/fireside/comments/${id}`, {
        ...init,
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? failure);
      }
      await load(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : failure);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ background: t.BG, minHeight: "100%" }}>
      {/* The shared screen header, so the way back is the same control as everywhere else in the
          app (rule 134). This screen shipped without one and had no way back at phone width, which
          is the breakpoint the whole web app renders at (owner report, 2026-09-14). */}
      <MobileScreenHeader title="Fireside" accent={t.ACCENT} icon={<Flame size={18} color={t.ACCENT} />} />
      <div style={{ padding: "20px 16px 48px" }}>
      {queueOpen ? (
        <FiresideExportQueue t={t} onClose={() => { setQueueOpen(false); void load(page); }} />
      ) : adminListOpen ? (
        <FiresideAdminComments t={t} onClose={() => { setAdminListOpen(false); void load(page); }} />
      ) : openPost ? (
        <FiresideThreadView
          postRepo={openPost.repo}
          postSlug={openPost.slug}
          postTitle={openPost.title}
          isAdmin={isAdmin}
          t={t}
          cameFromPost={cameFromPost}
          onClose={() => { setOpenPost(null); setCameFromPost(false); void load(page); }}
        />
      ) : (
      <>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: t.TEXT, margin: "0 0 6px" }}>Fireside</h1>
      <p style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.6, marginTop: 0 }}>
        Conversation under the posts on the blog. This screen is your side of it — everything you
        have written, and what is happening to each one.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <BlogLink t={t} label="Open the blog" />
        {isAdmin && (
          <>
            <button type="button" onClick={() => setQueueOpen(true)}
              style={{ background: "transparent", border: `1px solid ${t.BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, color: t.ACCENT, cursor: "pointer" }}>
              Blog export queue
            </button>
            <button type="button" onClick={() => setAdminListOpen(true)}
              style={{ background: "transparent", border: `1px solid ${t.BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, color: t.ACCENT, cursor: "pointer" }}>
              Recent comments
            </button>
          </>
        )}
      </div>

      <Guidelines t={t} />

      {error && (
        <div role="alert" style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 13, color: "#EF4444" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: t.SUBTLE }}>Loading…</div>
      ) : comments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: t.SUBTLE, fontSize: 13, lineHeight: 1.6 }}>
          You have not written anything here yet.
          <br />
          Open a post on the blog and use the conversation under it; whatever you write shows up on
          this screen afterwards, with what is happening to each one.
          <div style={{ marginTop: 16 }}>
            <BlogLink t={t} label="Open the blog" />
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: t.FAINT, marginBottom: 10 }}>
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </div>
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              t={t}
              busyId={busyId}
              onWithdraw={(id) => void send(id, { method: "DELETE" }, "Could not take that down.")}
              onToggleExport={(id, next) =>
                void send(id, { method: "PATCH", body: JSON.stringify({ exportToBlog: next }) }, "Could not change that setting.")}
              onOpenThread={(row) => {
                setCameFromPost(false);
                setOpenPost({ repo: row.postRepo, slug: row.postSlug, title: row.postTitle });
              }}
            />
          ))}
          <Pager page={page} lastPage={lastPage} t={t} onPage={(next) => void load(next)} />
        </>
      )}
      </>
      )}
      </div>
    </div>
  );
}
