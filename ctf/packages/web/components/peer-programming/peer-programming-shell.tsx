"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { BG, type Message, type Room, type Tab } from "./pp-shared";
import { PeerProgrammingLoading } from "./pp-loading";
import { PeerProgrammingIconRail } from "./pp-icon-rail";
import { PeerProgrammingSidebar } from "./pp-sidebar";
import { PeerProgrammingCohortsTab } from "./pp-cohorts-tab";
import { PeerProgrammingSessionTab } from "./pp-session-tab";
import { PeerProgrammingChatTab } from "./pp-chat-tab";
import { PeerProgrammingRightPanel } from "./pp-right-panel";

async function fetchRoomData(signal: AbortSignal): Promise<{ room: Room; messages: Message[] }> {
  const res = await fetch("/api/peer-programming/room", { signal });
  if (!res.ok) throw new Error("Failed to load room");
  const room = (await res.json()) as Room;
  let messages: Message[] = [];
  if (room?.cohortId) {
    const msgRes = await fetch("/api/peer-programming/messages", { signal });
    if (!msgRes.ok) throw new Error("Failed to load messages");
    messages = (await msgRes.json()) as Message[];
  }
  return { room, messages };
}

function ShellHeader({ active }: { active: boolean }) {
  return (
    <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
      <Users size={18} style={{ color: "#8B5CF6" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>Peer Programming</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>Weekly global masterminds · 12 per cohort · Always-open</div>
      </div>
      {active && (
        <span style={{ background: "#8B5CF620", color: "#8B5CF6", border: "1px solid #8B5CF635", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
          Cohort Active
        </span>
      )}
    </header>
  );
}

export function PeerProgrammingShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("cohorts");
  const [messageInput, setMessageInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const { room: loadedRoom, messages: loadedMessages } = await fetchRoomData(controller.signal);
        if (controller.signal.aborted) return;
        setRoom(loadedRoom);
        setMessages(loadedMessages);
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

  async function handlePostMessage() {
    if (!messageInput.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/peer-programming/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageInput }),
      });
      if (!res.ok) throw new Error("Failed to post message");
      setMessageInput("");
      const msgRes = await fetch("/api/peer-programming/messages");
      if (msgRes.ok) setMessages((await msgRes.json()) as Message[]);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: feedbackInput }),
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

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <PeerProgrammingIconRail tab={tab} onTab={setTab} />
      <PeerProgrammingSidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <ShellHeader active={Boolean(room?.cohortId)} />
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
          />
        )}
      </div>
      <PeerProgrammingRightPanel room={room} participants={participants} onJoinSession={() => setTab("session")} />
    </div>
  );
}
