"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { useTheme } from "@/hooks/useTheme";
import { BG, getPeerProgrammingTokens, type CohortSummary, type Message, type Room, type RoomAccess, type Tab } from "./pp-shared";
import { PeerProgrammingLoading } from "./pp-loading";
import { PeerProgrammingCohortsTab } from "./pp-cohorts-tab";
import { PeerProgrammingSessionTab } from "./pp-session-tab";
import { PeerProgrammingChatTab } from "./pp-chat-tab";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";

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
  ended?: boolean;
};

type RoomData = {
  room: Room;
  messages: Message[];
  cohorts: CohortSummary[];
  members: RoomMember[];
  myCohortId: string | null;
  access: RoomAccess;
};

// Resolve a message author's display name: their @username from the cohort roster, or a short
// id fallback when Clerk could not resolve them. Matches the mobile memberName helper so the same
// author reads the same way on both surfaces.
function authorDisplayName(authorUserId: string, namesByUserId: Map<string, string>): string {
  return namesByUserId.get(authorUserId) ?? `Member ${authorUserId.slice(0, 6)}`;
}

function mapMessages(rows: RoomApiMessage[], members: RoomMember[] = []): Message[] {
  const namesByUserId = new Map<string, string>();
  for (const member of members) {
    if (member.username) namesByUserId.set(member.userId, member.username);
  }
  return rows.map((row) => ({
    id: row.id,
    author: authorDisplayName(row.authorUserId, namesByUserId),
    authorId: row.authorUserId,
    content: row.body,
    timestamp: row.createdAtIso,
    metadata: row.parentMessageId ? { parentMessageId: row.parentMessageId } : undefined,
  }));
}

function roomUrl(cohortId?: string | null): string {
  return cohortId ? `/api/peer-programming/room?cohortId=${encodeURIComponent(cohortId)}` : "/api/peer-programming/room";
}

// Map the API cohort/topic block onto the shell's Room view model. Kept separate from the full
// RoomData mapping so each stays under the complexity budget.
function mapRoom(data: RoomApiResponse): Room {
  return {
    id: data.cohort?.id ?? "peer-programming-room",
    cohortId: data.cohort?.id,
    name: data.cohort?.cohortLabel,
    topic: data.topic?.title,
    participants: [],
    ended: Boolean(data.ended),
  };
}

function mapRoomData(data: RoomApiResponse): RoomData {
  return {
    room: mapRoom(data),
    messages: mapMessages(data.messages ?? [], data.members ?? []),
    cohorts: data.cohorts ?? [],
    members: data.members ?? [],
    myCohortId: data.myCohortId ?? null,
    access: data.access ?? (data.cohort ? "member" : "listener"),
  };
}

async function fetchRoomData(signal: AbortSignal, cohortId?: string | null): Promise<RoomData> {
  const res = await fetch(roomUrl(cohortId), { signal });
  if (!res.ok) throw new Error("Failed to load room");
  const data = (await res.json()) as RoomApiResponse;
  return mapRoomData(data);
}

// Pull a human-readable message off a thrown value, falling back when it is not an Error.
function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

// Re-pull just the open cohort's messages after a successful post. Returns null when the room
// endpoint fails, so the caller leaves the existing messages in place.
async function fetchRoomMessages(cohortId: string | null): Promise<Message[] | null> {
  const roomRes = await fetch(roomUrl(cohortId));
  if (!roomRes.ok) return null;
  const data = (await roomRes.json()) as RoomApiResponse;
  return mapMessages(data.messages ?? [], data.members ?? []);
}

// Read an optional ?cohortId= from the URL on the client (admin "Open room →" deep links and
// listen-in links use it). Done from window rather than useSearchParams to avoid a Suspense
// boundary requirement on this client shell.
function initialCohortIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("cohortId");
}

const TABS: { key: Tab; label: string }[] = [
  { key: "cohorts", label: "Cohorts" },
  { key: "session", label: "Session" },
  { key: "chat", label: "Direct Line" },
];

// Full-height error message, shown when the room fails to load.
function PeerProgrammingErrorState({ error }: { error: string }) {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontFamily: "Inter, system-ui, sans-serif" }}>
      {error}
    </div>
  );
}

// Sticky header: back control, title, admin/refresh actions, and the tab switcher.
function PeerProgrammingHeader({ t, isAdmin, tab, onSelectTab, onRefresh }: {
  t: ReturnType<typeof getPeerProgrammingTokens>;
  isAdmin?: boolean;
  tab: Tab;
  onSelectTab: (tab: Tab) => void;
  onRefresh: () => void | Promise<void>;
}) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
        <BackChevronButton accent={t.ACCENT} />
        <Users size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
        {/* Title shrinks and truncates so the trailing controls always stay on screen */}
        <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>PeerProgramming</span>
        <PluginAdminButton href="/admin/peer-programming" isAdmin={isAdmin} accent={t.ACCENT} />
        <RefreshButton onRefresh={onRefresh} title="Refresh" />
        <MobileTopActions />
      </div>
      <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => onSelectTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? t.ACCENT_TINT_BG : "transparent", border: `1px solid ${tab === key ? t.ACCENT_TAB_BORDER : t.BORDER_STRONG}`, color: tab === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

// Body for the active tab. Which tab is shown is driven entirely by `tab`; the other tabs render
// nothing, matching the original inline switch.
function PeerProgrammingTabContent(props: {
  tab: Tab;
  room: Room | null;
  messages: Message[];
  messageInput: string;
  onMessageInput: (value: string) => void;
  onSend: () => void;
  submitting: boolean;
  access: RoomAccess;
  onJoinSession: () => void;
  feedbackInput: string;
  onFeedbackInput: (value: string) => void;
  onSubmitFeedback: (e: React.FormEvent) => void;
  feedbackSuccess: boolean;
  feedbackError: string | null;
  cohorts: CohortSummary[];
  members: RoomMember[];
  myCohortId: string | null;
  activeCohortId: string | null;
  onOpenCohort: (id: string | null) => void;
  switching: boolean;
  isAdmin?: boolean;
}) {
  const {
    tab, room, messages, messageInput, onMessageInput, onSend, submitting, access,
    onJoinSession, feedbackInput, onFeedbackInput, onSubmitFeedback, feedbackSuccess,
    feedbackError, cohorts, members, myCohortId, activeCohortId, onOpenCohort, switching, isAdmin,
  } = props;
  const participants = room?.participants ?? [];
  return (
    <>
      {tab === "cohorts" && (
        <PeerProgrammingCohortsTab
          room={room}
          onJoinSession={onJoinSession}
          feedback={{
            value: feedbackInput,
            onChange: onFeedbackInput,
            onSubmit: onSubmitFeedback,
            submitting,
            success: feedbackSuccess,
            error: feedbackError,
          }}
          cohorts={cohorts}
          members={members}
          myCohortId={myCohortId}
          openCohortId={activeCohortId}
          onOpenCohort={onOpenCohort}
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
          onMessageInput={onMessageInput}
          onSend={onSend}
          submitting={submitting}
          readOnly={access !== "member"}
          ended={Boolean(room?.ended)}
        />
      )}
    </>
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
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);

  // Commit a fetched room payload to state in one place, so every load path (initial, refresh,
  // cohort switch) settles the same fields the same way.
  const applyRoomData = useCallback((data: RoomData) => {
    setRoom(data.room);
    setMessages(data.messages);
    setCohorts(data.cohorts);
    setMembers(data.members);
    setMyCohortId(data.myCohortId);
    setAccess(data.access);
  }, []);

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
        applyRoomData(data);
      } catch (e: unknown) {
        if (controller.signal.aborted || (e instanceof Error && e.name === "AbortError")) return;
        setError(errorMessage(e, "Failed to load PeerProgramming data."));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void fetchData();
    return () => controller.abort();
  }, [applyRoomData]);

  // One controller for the latest reload/switch request. Each new request aborts the previous
  // one, so two rapid cohort switches (or a switch racing a refresh) can never settle state in
  // the wrong order, and nothing keeps loading after unmount.
  const roomRequestRef = useRef<AbortController | null>(null);
  const nextRoomRequestSignal = useCallback(() => {
    roomRequestRef.current?.abort();
    const controller = new AbortController();
    roomRequestRef.current = controller;
    return controller.signal;
  }, []);
  useEffect(() => () => roomRequestRef.current?.abort(), []);

  // Re-pull the currently open room in the background (refresh button) without
  // showing the full-screen loading state.
  const reloadRoom = useCallback(async () => {
    const signal = nextRoomRequestSignal();
    try {
      const data = await fetchRoomData(signal, activeCohortId);
      if (signal.aborted) return;
      applyRoomData(data);
    } catch (e: unknown) {
      if (signal.aborted || (e instanceof Error && e.name === "AbortError")) return;
      setError(errorMessage(e, "Failed to refresh PeerProgramming data."));
    }
  }, [activeCohortId, nextRoomRequestSignal, applyRoomData]);

  // Open another running cohort to listen in (read-only unless you are a member of it). Passing
  // null returns to your own cohort. Refetches the room for that cohort and jumps to the chat.
  async function openCohort(cohortId: string | null) {
    setSwitching(true);
    setError(null);
    const signal = nextRoomRequestSignal();
    try {
      const data = await fetchRoomData(signal, cohortId);
      if (signal.aborted) return;
      applyRoomData(data);
      setActiveCohortId(cohortId);
      setTab("chat");
    } catch (e: unknown) {
      if (signal.aborted || (e instanceof Error && e.name === "AbortError")) return;
      setError(errorMessage(e, "Failed to open that cohort."));
    } finally {
      // A superseded (aborted) call must not clear the spinner the newer call just turned on.
      if (!signal.aborted) setSwitching(false);
    }
  }

  async function handlePostMessage() {
    if (!messageInput.trim()) return;
    const cohortId = room?.cohortId;
    if (!cohortId) { setError("You are not in a cohort yet."); return; }
    if (access !== "member") { setError("You are listening in — only cohort members can post here."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/peer-programming/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ cohortId, body: messageInput }),
      });
      if (!res.ok) throw new Error("Failed to post message");
      setMessageInput("");
      // The room endpoint is the source of truth for the open cohort's messages.
      const refreshed = await fetchRoomMessages(activeCohortId);
      if (refreshed) setMessages(refreshed);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to post message."));
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
      setFeedbackError(errorMessage(err, "Failed to submit feedback."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PeerProgrammingLoading />;
  if (error) return <PeerProgrammingErrorState error={error} />;

  return (
    <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
      <PeerProgrammingHeader t={t} isAdmin={isAdmin} tab={tab} onSelectTab={setTab} onRefresh={reloadRoom} />
      <PeerProgrammingTabContent
        tab={tab}
        room={room}
        messages={messages}
        messageInput={messageInput}
        onMessageInput={setMessageInput}
        onSend={() => void handlePostMessage()}
        submitting={submitting}
        access={access}
        onJoinSession={() => setTab("session")}
        feedbackInput={feedbackInput}
        onFeedbackInput={setFeedbackInput}
        onSubmitFeedback={(e) => void handleSubmitFeedback(e)}
        feedbackSuccess={feedbackSuccess}
        feedbackError={feedbackError}
        cohorts={cohorts}
        members={members}
        myCohortId={myCohortId}
        activeCohortId={activeCohortId}
        onOpenCohort={(id) => void openCohort(id)}
        switching={switching}
        isAdmin={isAdmin}
      />
    </div>
  );
}
