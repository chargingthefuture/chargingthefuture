"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Heart } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
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
  const isMobile = useIsMobile();

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
      {tab === "chat" && (
        <GentlePulseChat chatInput={chatInput} onChatInput={setChatInput} onBrowse={() => setTab("sessions")} />
      )}
    </>
  );

  if (isMobile) {
    const tabs: { key: Tab; label: string }[] = [
      { key: "sessions", label: "Sessions" },
      { key: "chat", label: "Chat" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#080D0C", borderBottom: "1px solid rgba(20,184,166,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${COLOR}14`, border: `1px solid ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", color: COLOR, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <Heart size={18} style={{ color: COLOR, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", flex: 1 }}>GentlePulse</span>
            <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 10, padding: "3px 8px", borderRadius: 20, flexShrink: 0 }}>✓ Safe</Badge>
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? `${COLOR}1A` : "transparent", border: `1px solid ${tab === key ? COLOR + "40" : "rgba(255,255,255,0.08)"}`, color: tab === key ? COLOR : "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {tab === "sessions" && (
            <div style={{ display: "flex", gap: 6, padding: "0 12px 10px", overflowX: "auto" }}>
              {categories.map((c) => (
                <button key={c} onClick={() => setCategory(c)} style={{ whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 14, background: category === c ? `${COLOR}14` : "transparent", border: `1px solid ${category === c ? COLOR + "50" : "rgba(255,255,255,0.1)"}`, color: category === c ? COLOR : "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>{c}</button>
              ))}
            </div>
          )}
        </div>
        {content}
      </div>
    );
  }

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

        {content}
      </div>

      <GentlePulseRightPanel sessions={sessions} onPlay={(id) => void handlePlay(id)} />
    </div>
  );
}
