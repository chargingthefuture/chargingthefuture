"use client";

import { useCallback, useEffect, useState } from "react";
import type { PluginShellTokens } from "@/components/shared/plugin-shell-theme";
import { Pager } from "./fireside-pager";
import { useUrlPage } from "./fireside-url-page";

// Searching the conversation, as a member.
//
// The comment bodies have been indexed since 2026-09-14 and only an admin could search them, which
// left a member as the one person who could not find a conversation they remembered being part of.
// Being searchable is one of the four reasons these comments are in Postgres rather than in a chat
// product, and a search only moderators can run does not deliver that to anybody the plugin is for.
//
// This is a search and not the browse-every-conversation view the owner tabled on 2026-09-13. It
// answers a question somebody already has and shows nothing at all until they ask one — where a
// browse view invites scrolling the room, which is a different decision and still the owner's.
//
// What comes back is only what the person searching may read. The server decides that, from the
// same visibility rule the thread read uses; this screen renders what it is given.

type SearchHit = {
  commentId: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  postRepo: string;
  postSlug: string;
  postTitle: string;
  isOwn: boolean;
};

type SearchAnswer = {
  hits: SearchHit[];
  page: number;
  lastPage: number;
  total: number;
  moreThanShown: boolean;
};

function SearchBox({
  t,
  value,
  onChange,
  onSubmit,
  onClear,
}: {
  t: PluginShellTokens;
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
    >
      <label htmlFor="fireside-member-search" style={{ flexBasis: "100%", fontSize: 13, color: t.SUBTLE, lineHeight: 1.6 }}>
        Search the conversation. Quoted words are kept together, and a minus sign leaves one out.
      </label>
      <input
        id="fireside-member-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="A word or a phrase"
        style={{ flex: 1, minWidth: 160, boxSizing: "border-box", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 15, color: t.TEXT }}
      />
      <button type="submit"
        style={{ background: t.ACCENT, color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        Search
      </button>
      {value && (
        <button type="button" onClick={onClear}
          style={{ background: "transparent", border: `1px solid ${t.BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: t.SUBTLE, cursor: "pointer" }}>
          Clear
        </button>
      )}
    </form>
  );
}

// One match. The post title is the control, because what somebody wants after finding a comment is
// the conversation around it rather than the comment on its own.
function HitRow({
  hit,
  t,
  onOpenThread,
}: {
  hit: SearchHit;
  t: PluginShellTokens;
  onOpenThread: (post: { repo: string; slug: string; title: string }) => void;
}) {
  return (
    <div style={{ background: t.SURFACE, border: `1px solid ${t.BORDER}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => onOpenThread({ repo: hit.postRepo, slug: hit.postSlug, title: hit.postTitle })}
        style={{ fontSize: 14, color: t.ACCENT, background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontWeight: 600 }}
      >
        {hit.postTitle || hit.postSlug}
      </button>
      <div style={{ fontSize: 13, color: t.SUBTLE, margin: "6px 0" }}>
        {hit.isOwn ? "You" : hit.authorName}
      </div>
      <div style={{ fontSize: 15, color: t.TEXT, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{hit.body}</div>
      {hit.editedAt && <div style={{ fontSize: 13, color: t.SUBTLE, marginTop: 6 }}>Edited</div>}
    </div>
  );
}

export function FiresideSearch({
  t,
  onOpenThread,
}: {
  t: PluginShellTokens;
  onOpenThread: (post: { repo: string; slug: string; title: string }) => void;
}) {
  // The page is in the address bar, so a search can be linked and the back button steps through it.
  const [page, setPage] = useUrlPage("found");
  // `draft` is what is typed; `query` is what was actually searched for. Keeping them apart is why
  // typing does not fire a query against every comment on each keystroke.
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (wanted: number, search: string) => {
    if (search.length < 2) {
      setAnswer(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fireside/search?q=${encodeURIComponent(search)}&page=${wanted}`);
      const body = (await res.json().catch(() => ({}))) as SearchAnswer & { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Could not search the conversation.");
      // The route clamps a page past the end and answers with the one it used.
      if (body.page !== wanted) setPage(body.page);
      setAnswer(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not search the conversation.");
      setAnswer(null);
    } finally {
      setLoading(false);
    }
  }, [setPage]);

  useEffect(() => { void load(page, query); }, [load, page, query]);

  return (
    <div style={{ marginBottom: 24 }}>
      <SearchBox
        t={t}
        value={draft}
        onChange={setDraft}
        onSubmit={() => { setPage(1); setQuery(draft.trim()); }}
        onClear={() => { setDraft(""); setPage(1); setQuery(""); setAnswer(null); }}
      />

      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 15, color: "#F87171" }}>
          {error}
        </div>
      )}

      {loading && <div style={{ fontSize: 15, color: t.SUBTLE }}>Searching…</div>}

      {!loading && answer && answer.total === 0 && (
        <div style={{ fontSize: 15, color: t.TEXT, lineHeight: 1.7 }}>
          Nothing matches that. Only what you can already read is searched, so a comment held until
          its author is approved will not be here yet.
        </div>
      )}

      {!loading && answer && answer.total > 0 && (
        <>
          <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 10 }}>
            Showing {(answer.page - 1) * 20 + 1}–{Math.min(answer.page * 20, answer.total)} of{" "}
            {answer.total}
          </div>
          {/* Said plainly rather than left to be guessed from a round number: the search stopped
              looking, and a narrower one finds what this one may have missed. */}
          {answer.moreThanShown && (
            <div style={{ fontSize: 13, color: "#F59E0B", lineHeight: 1.7, marginBottom: 10 }}>
              There are more matches than this search looked at. Narrow it and search again.
            </div>
          )}
          {answer.hits.map((hit) => (
            <HitRow key={hit.commentId} hit={hit} t={t} onOpenThread={onOpenThread} />
          ))}
          <Pager page={answer.page} lastPage={answer.lastPage} t={t} onPage={setPage} />
        </>
      )}
    </div>
  );
}
