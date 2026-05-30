"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Heart } from "lucide-react";
import { BG, COLOR, FAINT, type Session, type Tab } from "./gp-shared";
import { GentlePulseLoading } from "./gp-loading";
import { GentlePulseIconRail } from "./gp-icon-rail";
import { GentlePulseSidebar } from "./gp-sidebar";
import { GentlePulseSessions } from "./gp-sessions";
import { GentlePulsePlayer } from "./gp-player";
import { GentlePulseChat } from "./gp-chat";
import { GentlePulseRightPanel } from "./gp-right-panel";

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
  const [chatInput, setChatInput] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let didAbort = false;
    async function fetchLibrary() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/gentlepulse/library", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to load wellness content");
        const data = await res.json() as { sessions?: Session[]; categories?: string[] };
        if (!didAbort) {
          setSessions(data.sessions ?? []);
          setCategories(["All", ...(data.categories ?? [])]);
        }
      } catch (e: unknown) {
        if ((e as Error).name === "AbortError") {
          didAbort = true;
        } else if (!didAbort) {
          setError(e instanceof Error ? e.message : "Failed to load wellness content.");
        }
      } finally {
        if (!didAbort) setLoading(false);
      }
    }
    void fetchLibrary();
    return () => { didAbort = true; controller.abort(); };
  }, []);

  async function handlePlay(sessionId: string) {
    setPlaying(sessionId);
    setTab("playing");
    try {
      await fetch(`/api/gentlepulse/library/${sessionId}/play`, { method: "POST" });
    } catch {
      // Fire-and-forget play tracking
    }
  }

  async function handleFavorite(sessionId: string, isFav: boolean) {
    setSubmitting(true);
    try {
      const method = isFav ? "DELETE" : "POST";
      await fetch(`/api/gentlepulse/library/${sessionId}/favorite`, { method });
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
      <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  const filtered = category === "All" ? sessions : sessions.filter((s) => s.category === category);
  const playingSession = playing ? sessions.find((s) => s.id === playing) ?? null : null;

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <GentlePulseIconRail tab={tab} onTab={setTab} />
      <GentlePulseSidebar
        categories={categories}
        category={category}
        onCategory={setCategory}
        sessionCount={sessions.length}
        favoriteCount={favorites.size}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(20,184,166,0.1)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#080D0C", flexShrink: 0 }}>
          <Heart size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>💚 GentlePulse — Guided Meditation</div>
            <div style={{ fontSize: 12, color: FAINT }}>Trauma-informed · Expert-designed · Safe sanctuary</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
            ✓ Trauma-Informed
          </Badge>
        </header>

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
        {tab === "chat" && (
          <GentlePulseChat chatInput={chatInput} onChatInput={setChatInput} onBrowse={() => setTab("sessions")} />
        )}
      </div>

      <GentlePulseRightPanel sessions={sessions} onPlay={(id) => void handlePlay(id)} />
    </div>
  );
}
