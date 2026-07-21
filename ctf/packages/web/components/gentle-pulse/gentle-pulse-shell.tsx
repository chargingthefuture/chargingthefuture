"use client";

import { useCallback, useEffect, useState } from "react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { Heart } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getGentlePulseTokens, type Session, type Tab } from "./gp-shared";
import { GentlePulseLoading } from "./gp-loading";
import { GentlePulseSessions } from "./gp-sessions";
import { GentlePulsePlayer } from "./gp-player";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";

export function GentlePulseShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [tab, setTab] = useState<Tab>("sessions");
  const [category, setCategory] = useState("All");
  const [playing, setPlaying] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [progress] = useState(40);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const { theme } = useTheme();
  const t = getGentlePulseTokens(theme);

  // Fetch the session library. Shared by the initial mount effect (initial = true, shows the
  // full-screen loading state) and the header refresh button (initial = false, background re-pull).
  const fetchLibrary = useCallback(async (initial = false, signal?: AbortSignal) => {
    if (initial) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gentle-pulse/library", { signal });
      if (!res.ok) throw new Error("Failed to load wellness content");
      const data = await res.json() as { items?: Session[] };
      if (!signal?.aborted) {
        const items = data.items ?? [];
        setSessions(items);
        const derivedCategories = Array.from(
          new Set(items.map((s) => s.category).filter((c): c is string => Boolean(c))),
        );
        setCategories(["All", ...derivedCategories]);
      }
    } catch (e: unknown) {
      if (!signal?.aborted && (e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Failed to load wellness content.");
      }
    } finally {
      if (initial && !signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchLibrary(true, controller.signal);
    return () => { controller.abort(); };
  }, [fetchLibrary]);

  async function handlePlay(sessionId: string) {
    setPlaying(sessionId);
    setTab("playing");
    try {
      await fetch(`/api/gentle-pulse/library/${sessionId}/play`, { method: "POST", headers: { "x-ctf-csrf": "1" } });
    } catch {
      // Fire-and-forget play tracking
    }
  }

  async function handleFavorite(sessionId: string, isFav: boolean) {
    setSubmitting(true);
    try {
      const method = isFav ? "DELETE" : "POST";
      await fetch(`/api/gentle-pulse/library/${sessionId}/favorite`, { method, headers: { "x-ctf-csrf": "1" } });
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(sessionId); else next.add(sessionId);
        return next;
      });
    } catch {
      // Ignore favorite errors
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <GentlePulseLoading />;
  if (error) {
    return (
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: t.BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  const filtered = category === "All" ? sessions : sessions.filter((s) => s.category === category);
  const playingSession = playing ? sessions.find((s) => s.id === playing) ?? null : null;

  const content = (
    <>
      {tab === "sessions" && (
        <GentlePulseSessions
          sessions={sessions}
          filtered={filtered}
          favorites={favorites}
          submitting={submitting}
          onPlay={(id) => void handlePlay(id)}
          onToggleFavorite={(id, isFav) => void handleFavorite(id, isFav)}
        />
      )}
      {tab === "playing" && (
        <GentlePulsePlayer
          session={playingSession}
          isPaused={isPaused}
          progress={progress}
          onTogglePause={() => setIsPaused((p) => !p)}
          onClose={() => setTab("sessions")}
          onBrowse={() => setTab("sessions")}
        />
      )}
    </>
  );

    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <BackChevronButton accent={t.ACCENT} />
            <Heart size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            {/* Title shrinks and truncates so the trailing controls stay on screen */}
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>GentlePulse</span>
            <RefreshButton onRefresh={() => fetchLibrary()} title="Refresh" />
            <MobileTopActions />
          </div>
          {tab === "sessions" && (
            <div style={{ display: "flex", gap: 6, padding: "0 12px 10px", overflowX: "auto" }}>
              {categories.map((c) => (
                <button key={c} onClick={() => setCategory(c)} style={{ whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 14, background: category === c ? `${t.ACCENT}14` : "transparent", border: `1px solid ${category === c ? t.ACCENT + "50" : t.BORDER_HI}`, color: category === c ? t.ACCENT : t.SUBTLE, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>{c}</button>
              ))}
            </div>
          )}
        </div>
        {content}
      </div>
    );
}
