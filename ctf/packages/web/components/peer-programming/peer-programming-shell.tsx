"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useTheme } from "@/hooks/useTheme";
import { BG, getPeerProgrammingTokens, type CohortSummary, type Message, type PeerProgrammingTokens, type Room, type RoomAccess, type Tab } from "./pp-shared";
import { PeerProgrammingLoading } from "./pp-loading";
import { PeerProgrammingIconRail } from "./pp-icon-rail";
import { PeerProgrammingSidebar } from "./pp-sidebar";
import { PeerProgrammingCohortsTab } from "./pp-cohorts-tab";
import { PeerProgrammingSessionTab } from "./pp-session-tab";
import { PeerProgrammingChatTab } from "./pp-chat-tab";
import { PeerProgrammingRightPanel } from "./pp-right-panel";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";

// Shape returned by GET /api/peer-programming/room. The shell's view models (Room,
// Message) differ from the API, so map explicitly here rather than casting.
type RoomApiTopic = { title: string } | null;
type RoomApiCohort = { id: string; cohortLabel: string; memberCount: number; fallbackOpen: boolean } | null;
type RoomApiMessage = { id: string; authorUserId: string; body: string; createdAtIso: string; parentMessageId: string | null };
// A cohort member surfaced to the roster: user id + resolved display name (null when unresolved).
type RoomMember = { userId: string; username: string | null };
type RoomApiResponse = {
  ok: boolean;
  topic: RoomApiTopic;
  cohort: RoomApiCohort;
  messages: RoomApiMessage[];
  cohorts?: CohortSummary[];
  members?: RoomMember[];
  myCohortId?: string | null;
  access?: RoomAccess;
};

type RoomData = {
  room: Room;
  messages: Message[];
  cohorts: CohortSummary[];
  members: RoomMember[];
  myCohortId: string | null;
  access: RoomAccess;
};

function mapMessages(rows: RoomApiMessage[]): Message[] {
  return rows.map((row) => ({
    id: row.id,
    authorId: row.authorUserId,
    content: row.body,
    timestamp: row.createdAtIso,
    metadata: row.parentMessageId ? { parentMessageId: row.parentMessageId } : undefined,
  }));
}

function roomUrl(cohortId?: string | null): string {
  return cohortId ? `/api/peer-programming/room?cohortId=${encodeURIComponent(cohortId)}` : "/api/peer-programming/room";
}

async function fetchRoomData(signal: AbortSignal, cohortId?: string | null): Promise<RoomData> {
  const res = await fetch(roomUrl(cohortId), { signal });
  if (!res.ok) throw new Error("Failed to load room");
  const data = (await res.json()) as RoomApiResponse;
  const room: Room = {
    id: data.cohort?.id ?? "peer-programming-room",
    cohortId: data.cohort?.id,
    name: data.cohort?.cohortLabel,
    topic: data.topic?.title,
    participants: [],
  };
  return {
    room,
    messages: mapMessages(data.messages ?? []),
    cohorts: data.cohorts ?? [],
    members: data.members ?? [],
    myCohortId: data.myCohortId ?? null,
    access: data.access ?? (data.cohort ? "member" : "listener"),
  };
}

// Read an optional ?cohortId= from the URL on the client (admin "Open room →" deep links and
// listen-in links use it). Done from window rather than useSearchParams to avoid a Suspense
// boundary requirement on this client shell.
function initialCohortIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("cohortId");
}

function ShellHeader({ active, t, isAdmin }: { active: boolean; t: PeerProgrammingTokens; isAdmin?: boolean }) {
  return (
    <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: t.HEADER, flexShrink: 0 }}>
      <Users size={18} style={{ color: t.ACCENT }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.TEXT }}>Peer Programming</div>
        <div style={{ fontSize: 12, color: t.MUTED }}>Weekly global masterminds · 12 per cohort · Always-open</div>
      </div>
      {active && (
        <span style={{ background: `${t.ACCENT}20`, color: t.ACCENT, border: `1px solid ${t.ACCENT}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
          Cohort Active
        </span>
      )}
      <PluginAdminButton href="/admin/peer-programming" isAdmin={isAdmin} accent={t.ACCENT} />
    </header>
  );
}

export function PeerProgrammingShell({ isAdmin }: { isAdmin?: boolean } = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [myCohortId, setMyCohortId] = useState<string | null>(null);
  const [access, setAccess] = useState<RoomAccess>("listener");
  // Which cohort's room is open. null = the viewer's own cohort (the default room).
  const [activeCohortId, setActiveCohortId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("cohorts");
  const [messageInput, setMessageInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);

  useEffect(() => {
    const controller = new AbortController();
    const deepLinked = initialCohortIdFromUrl();
    if (deepLinked) {
      setActiveCohortId(deepLinked);
      setTab("chat");
    }
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRoomData(controller.signal, deepLinked);
        if (controller.signal.aborted) return;
        setRoom(data.room);
        setMessages(data.messages);
        setCohorts(data.cohorts);
        setMembers(data.members);
        setMyCohortId(data.myCohortId);
        setAccess(data.access);
      } catch (e: unknown) {
        if (controller.signal.aborted || (e instanceof Error && e.name === "AbortError")) return;
        setError(e instanceof Error ? e.message : "Failed to load peer programming data.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void fetchData();
    return () => controller.abort();
  }, []);

  // Open another running cohort to listen in (read-only unless you are a member of it). Passing
  // null returns to your own cohort. Refetches the room for that cohort and jumps to the chat.
  async function openCohort(cohortId: string | null) {
    setSwitching(true);
    setError(null);
    try {
      const data = await fetchRoomData(new AbortController().signal, cohortId);
      setRoom(data.room);
      setMessages(data.messages);
      setCohorts(data.cohorts);
      setMembers(data.members);
      setMyCohortId(data.myCohortId);
      setAccess(data.access);
      setActiveCohortId(cohortId);
      setTab("chat");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to open that cohort.");
    } finally {
      setSwitching(false);
    }
  }

  async function handlePostMessage() {
    if (!messageInput.trim()) return;
    if (!room?.cohortId) { setError("You are not in a cohort yet."); return; }
    if (access !== "member") { setError("You are listening in — only cohort members can post here."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/peer-programming/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ cohortId: room.cohortId, body: messageInput }),
      });
      if (!res.ok) throw new Error("Failed to post message");
      setMessageInput("");
      // The room endpoint is the source of truth for the open cohort's messages.
      const roomRes = await fetch(roomUrl(activeCohortId));
      if (roomRes.ok) {
        const data = (await roomRes.json()) as RoomApiResponse;
        setMessages(mapMessages(data.messages ?? []));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to post message.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackSuccess(false);
    setFeedbackError(null);
    if (!feedbackInput.trim()) { setFeedbackError("Feedback cannot be empty."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/peer-programming/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          cohortId: room?.cohortId ?? null,
          issueType: "general",
          suggestionCategory: "general",
          releaseSurface: "web",
          note: feedbackInput,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit feedback");
      setFeedbackSuccess(true);
      setFeedbackInput("");
    } catch (err: unknown) {
      setFeedbackError(err instanceof Error ? err.message : "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PeerProgrammingLoading />;
  if (error) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontFamily: "Inter, system-ui, sans-serif" }}>
        {error}
      </div>
    );
  }

  const participants = room?.participants ?? [];

  const content = (
    <>
      {tab === "cohorts" && (
        <PeerProgrammingCohortsTab
          room={room}
          participantCount={participants.length}
          onJoinSession={() => setTab("session")}
          feedback={{
            value: feedbackInput,
            onChange: setFeedbackInput,
            onSubmit: (e) => void handleSubmitFeedback(e),
            submitting,
            success: feedbackSuccess,
            error: feedbackError,
          }}
          cohorts={cohorts}
          members={members}
          myCohortId={myCohortId}
          openCohortId={activeCohortId}
          onOpenCohort={(id) => void openCohort(id)}
          switching={switching}
          isAdmin={Boolean(isAdmin)}
        />
      )}
      {tab === "session" && <PeerProgrammingSessionTab room={room} participants={participants} />}
      {tab === "chat" && (
        <PeerProgrammingChatTab
          room={room}
          messages={messages}
          messageInput={messageInput}
          onMessageInput={setMessageInput}
          onSend={() => void handlePostMessage()}
          submitting={submitting}
          readOnly={access !== "member"}
        />
      )}
    </>
  );

  if (isMobile) {
    const tabs: { key: Tab; label: string }[] = [
      { key: "cohorts", label: "Cohorts" },
      { key: "session", label: "Session" },
      { key: "chat", label: "Chat" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: t.ACCENT_TINT_BG, border: `1px solid ${t.ACCENT_TINT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <Users size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1 }}>Peer Programming</span>
            <PluginAdminButton href="/admin/peer-programming" isAdmin={isAdmin} accent={t.ACCENT} />
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? t.ACCENT_TINT_BG : "transparent", border: `1px solid ${tab === key ? t.ACCENT_TAB_BORDER : t.BORDER_STRONG}`, color: tab === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100dvh", overflow: "hidden", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT, display: "flex" }}>
      <PeerProgrammingIconRail tab={tab} onTab={setTab} />
      <PeerProgrammingSidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <ShellHeader active={Boolean(room?.cohortId)} t={t} isAdmin={isAdmin} />
        {content}
      </div>
      <PeerProgrammingRightPanel room={room} participants={participants} onJoinSession={() => setTab("session")} />
    </div>
  );
}
