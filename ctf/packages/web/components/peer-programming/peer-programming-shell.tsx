"use client";

import { useEffect, useRef, useState } from "react";

export interface Participant {
  id: string;
  name: string;
}

export interface Room {
  id: string;
  name?: string;
  cohortId?: string;
  participants?: Participant[];
  topic?: string;
  status?: string;
}

export interface Message {
  id: string;
  author?: string;
  authorId?: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const COLOR = "#8B5CF6";

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PeerProgrammingShell(_props: { userId?: string; isAdmin?: boolean }) {
  // All hooks must appear before any conditional returns
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"cohorts" | "session" | "chat">("cohorts");
  const [messageInput, setMessageInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/peer-programming/room", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to load room");
        const data = await res.json();
        if (controller.signal.aborted) return;
        setRoom(data as Room);
        if (data?.cohortId) {
          const msgRes = await fetch("/api/peer-programming/messages", { signal: controller.signal });
          if (!msgRes.ok) throw new Error("Failed to load messages");
          if (controller.signal.aborted) return;
          setMessages((await msgRes.json()) as Message[]);
        }
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Failed to load peer programming data.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchData();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, tab]);

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
    if (!feedbackInput.trim()) {
      setFeedbackError("Feedback cannot be empty.");
      return;
    }
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
    } catch (e: unknown) {
      setFeedbackError(e instanceof Error ? e.message : "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontFamily: "Inter, system-ui, sans-serif" }}>
        Loading Peer Programming…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontFamily: "Inter, system-ui, sans-serif" }}>
        {error}
      </div>
    );
  }

  const participants = room?.participants ?? [];

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 20, color: COLOR }}>👥</span>
        </div>
        {[
          { icon: "👥", key: "cohorts" },
          { icon: "🎥", key: "session" },
          { icon: "💬", key: "chat" },
        ].map(({ icon, key }) => (
          <button
            key={key}
            onClick={() => setTab(key as "cohorts" | "session" | "chat")}
            style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 20, color: tab === key ? COLOR : "#6B7280" }}
          >
            {icon}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280", fontSize: 18 }}>🔔</button>
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280", fontSize: 18 }}>⚙️</button>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>S</div>
      </aside>

      {/* Left sidebar */}
      <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>🏘️ Peer Programming</div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563", fontSize: 14 }}>🔍</span>
            <input
              placeholder="Search cohorts…"
              style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
          {["All Cohorts", "My Cohort", "Forming", "Active", "By Skill"].map((f, i) => (
            <div
              key={f}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: i === 0 ? `${COLOR}18` : "transparent", borderLeft: i === 0 ? `2px solid ${COLOR}` : "2px solid transparent", marginLeft: 2, marginBottom: 2 }}
            >
              <span style={{ fontSize: 13, color: i === 0 ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{f}</span>
              {f === "Forming" && <span style={{ background: "#F59E0B", borderRadius: 10, fontSize: 11, fontWeight: 700, color: "#fff", padding: "1px 6px" }}>2</span>}
            </div>
          ))}
          <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", padding: "0 10px" }}>How It Works</div>
          {["12 survivors per cohort", "Weekly 90-min sessions", "Deterministic placement", "Global, always-open"].map((l) => (
            <div key={l} style={{ padding: "5px 10px", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>• {l}</div>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <span style={{ fontSize: 18, color: COLOR }}>👥</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>🏘️ Peer Programming</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Weekly global masterminds · 12 per cohort · Always-open</div>
          </div>
          {room?.cohortId && (
            <span style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
              Cohort Active
            </span>
          )}
        </header>

        {/* Cohorts tab */}
        {tab === "cohorts" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(139,92,246,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Weekly Global Masterminds</div>
              <div style={{ fontSize: 14, color: "#9CA3AF" }}>Deterministic placement — you always get a cohort. No one left behind.</div>
            </div>

            {!room || !room.cohortId ? (
              <div style={{ textAlign: "center", color: "#9CA3AF", padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#E8EAF0", marginBottom: 8 }}>Not yet assigned to a cohort</div>
                <div style={{ fontSize: 14, color: "#6B7280" }}>Assignments happen every Monday. Check back soon.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}30` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>{room.name || `Cohort ${room.cohortId}`}</div>
                        <span style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E40", fontSize: 11, padding: "2px 8px", borderRadius: 12 }}>
                          {room.status === "active" ? "🔴 Active" : room.status || "Active"}
                        </span>
                      </div>
                      {room.topic && (
                        <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 10 }}>Topic: {room.topic}</div>
                      )}
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        {participants.length} participant{participants.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => setTab("session")}
                      style={{ padding: "10px 20px", borderRadius: 10, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                    >
                      Join Session
                    </button>
                  </div>
                </div>

                {/* Feedback */}
                <div style={{ padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.06)` }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#E8EAF0", marginBottom: 12 }}>Session Feedback</div>
                  <form onSubmit={handleSubmitFeedback} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <textarea
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      placeholder="How was your peer programming experience?"
                      rows={3}
                      disabled={submitting}
                      style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#E8EAF0", fontSize: 14, resize: "vertical", outline: "none" }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="submit"
                        disabled={submitting || !feedbackInput.trim()}
                        style={{ padding: "9px 20px", borderRadius: 8, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting || !feedbackInput.trim() ? 0.6 : 1 }}
                      >
                        {submitting ? "Submitting…" : "Submit Feedback"}
                      </button>
                      {feedbackSuccess && <span style={{ color: "#22C55E", fontSize: 13 }}>Thank you for your feedback!</span>}
                      {feedbackError && <span style={{ color: "#EF4444", fontSize: 13 }}>{feedbackError}</span>}
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Session tab */}
        {tab === "session" && (
          <div style={{ flex: 1, padding: 24 }}>
            <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(139,92,246,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Live Session</div>
              <div style={{ fontSize: 14, color: "#9CA3AF" }}>{room?.name || "Your Cohort"} · {participants.length} participants</div>
            </div>
            <div style={{ padding: "60px 0", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}30`, textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎥</div>
              <div style={{ fontSize: 16, color: "#6B7280", marginBottom: 4 }}>Video session via GetStream</div>
              {!room?.cohortId && <div style={{ fontSize: 13, color: "#4B5563" }}>Join a cohort to access live sessions</div>}
              {room?.cohortId && (
                <button style={{ marginTop: 16, padding: "12px 32px", borderRadius: 10, background: COLOR, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  Join Session
                </button>
              )}
            </div>
            {participants.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {participants.map((p) => (
                  <div key={p.id} style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}15`, textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${COLOR}25`, color: COLOR, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px" }}>
                      {initials(p.name || p.id)}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{p.name || p.id}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat tab */}
        {tab === "chat" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#9CA3AF", marginTop: 40 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                  <div style={{ fontSize: 15 }}>No messages yet. Start the conversation!</div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, color: COLOR, fontWeight: 700 }}>
                      {initials(msg.author || "?")}
                    </div>
                    <div style={{ maxWidth: "70%" }}>
                      <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>
                        {msg.author || "Anonymous"} · {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </div>
                      <div style={{ padding: "10px 14px", borderRadius: "12px 12px 12px 4px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, lineHeight: 1.6, color: "#E8EAF0" }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            {!room?.cohortId && (
              <div style={{ padding: "12px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", textAlign: "center", color: "#6B7280", fontSize: 13 }}>
                Join a cohort to participate in chat
              </div>
            )}
            {room?.cohortId && (
              <div style={{ padding: "8px 24px 20px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14 }}>
                  <input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePostMessage(); } }}
                    placeholder="Message your cohort…"
                    disabled={submitting}
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }}
                  />
                  <button
                    onClick={handlePostMessage}
                    disabled={submitting || !messageInput.trim()}
                    style={{ width: 32, height: 32, borderRadius: 8, background: messageInput.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: messageInput.trim() ? "pointer" : "not-allowed", fontSize: 16 }}
                  >
                    <span style={{ color: messageInput.trim() ? "#fff" : "#4B5563" }}>➤</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right panel */}
      <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>My Cohort</div>
        {!room?.cohortId ? (
          <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "#6B7280", fontSize: 13, textAlign: "center", marginBottom: 16 }}>
            Not yet in a cohort
          </div>
        ) : (
          <div style={{ padding: 16, borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, marginBottom: 8 }}>{room.name || `Cohort ${room.cohortId}`}</div>
            {room.topic && <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 6 }}>Topic: {room.topic}</div>}
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>
              Status: {room.status || "Active"}
            </div>
            <button
              onClick={() => setTab("session")}
              style={{ width: "100%", padding: 9, borderRadius: 8, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Join Next Session
            </button>
          </div>
        )}

        {participants.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Cohort Members</div>
            {participants.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: i < participants.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${COLOR}25`, color: COLOR, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {initials(p.name || p.id)}
                </div>
                <span style={{ fontSize: 13, color: "#9CA3AF" }}>{p.name || p.id}</span>
              </div>
            ))}
          </>
        )}
      </aside>
    </div>
  );
}
