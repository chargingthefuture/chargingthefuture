"use client";


import { useEffect, useState } from "react";

// Types for peer programming
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

export function PeerProgrammingShell(_props: { userId?: string; isAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchRoom() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/peer-programming/room', { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to load room');
        const data = await res.json();
        if (controller.signal.aborted) return;
        setRoom(data as Room);
        if (data && data.cohortId) {
          const msgRes = await fetch('/api/peer-programming/messages', { signal: controller.signal });
          if (!msgRes.ok) throw new Error('Failed to load messages');
          if (controller.signal.aborted) return;
          setMessages(await msgRes.json() as Message[]);
        } else {
          setMessages([]);
        }
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : String(e) || 'Failed to load peer programming data.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchRoom();
    return () => controller.abort();
  }, []);

  async function handlePostMessage(message: Pick<Message, 'content'>) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/peer-programming/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (!res.ok) throw new Error('Failed to post message');
      // Refetch messages after successful post
      const msgRes = await fetch('/api/peer-programming/messages');
      if (!msgRes.ok) throw new Error('Failed to fetch updated messages');
      setMessages(await msgRes.json() as Message[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e) || 'Failed to post message.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitFeedback(feedback: { feedback: string }) {
    setSubmitting(true);
    setError(null);
    setFeedbackSuccess(false);
    try {
      const res = await fetch('/api/peer-programming/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      });
      if (!res.ok) throw new Error('Failed to submit feedback');
      setFeedbackSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e) || 'Failed to submit feedback.');
      setFeedbackSuccess(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading peer programming…</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!room || !room.cohortId) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Peer Programming</h2>
        <p className="mb-4">You're not assigned to a cohort this week. Assignments happen every Monday.</p>
      </div>
    );
  }

  // ...existing UI code, now using room, messages, handlers...
  // Message input state
  const [messageInput, setMessageInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // MessageList component
  function MessageList({ messages }: { messages: Message[] }) {
    if (!messages.length) {
      return <div className="p-4 text-center text-muted-foreground">No messages yet. Start the conversation!</div>;
    }
    return (
      <div className="overflow-y-auto max-h-64 border rounded p-2 bg-white/5 mb-4">
        {messages.map((msg, i) => (
          <div key={msg.id || i} className="mb-2">
            <div className="text-xs text-gray-400 flex gap-2 items-center">
              <span className="font-bold text-gray-300">{msg.author || 'Anonymous'}</span>
              <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}</span>
            </div>
            <div className="text-sm text-gray-100">{msg.content}</div>
          </div>
        ))}
      </div>
    );
  }

  // Feedback form submit handler
  async function onFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackSuccess(false);
    setFeedbackError(null);
    if (!feedbackInput.trim()) {
      setFeedbackError("Feedback cannot be empty.");
      return;
    }
    try {
      await handleSubmitFeedback({ feedback: feedbackInput });
      setFeedbackSuccess(true);
      setFeedbackInput("");
    } catch (e: unknown) {
      setFeedbackError(e instanceof Error ? e.message : String(e) || "Failed to submit feedback.");
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      {/* Room metadata */}
      <section className="mb-4">
        <h2 className="text-2xl font-bold mb-1">Peer Programming Room</h2>
        <div className="text-gray-400 text-sm mb-1">Room: <span className="font-mono">{room.name || room.id}</span></div>
        {room.participants && room.participants.length > 0 && (
          <div className="text-gray-300 text-xs mb-2">Participants: {room.participants.map((p: Participant) => p.name || p.id).join(", ")}</div>
        )}
      </section>

      {/* Messages */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Messages</h3>
        <MessageList messages={messages} />
        {/* Message input form */}
        <form
          className="flex gap-2 mt-2"
          onSubmit={async e => {
            e.preventDefault();
            if (!messageInput.trim()) return;
            await handlePostMessage({ content: messageInput });
            setMessageInput("");
          }}
        >
          <input
            className="flex-1 rounded border px-3 py-2 text-sm bg-gray-900 text-white"
            type="text"
            value={messageInput}
            onChange={e => setMessageInput(e.target.value)}
            placeholder="Type your message…"
            disabled={submitting}
            required
          />
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white font-bold disabled:opacity-60"
            type="submit"
            disabled={submitting || !messageInput.trim()}
          >
            {submitting ? "Sending…" : "Send"}
          </button>
        </form>
      </section>

      {/* Feedback form */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Feedback</h3>
        <form className="flex flex-col gap-2" onSubmit={onFeedbackSubmit}>
          <textarea
            className="rounded border px-3 py-2 text-sm bg-gray-900 text-white"
            value={feedbackInput}
            onChange={e => setFeedbackInput(e.target.value)}
            placeholder="How was your peer programming experience?"
            rows={2}
            disabled={submitting}
            required
          />
          <div className="flex gap-2 items-center">
            <button
              className="rounded bg-green-600 px-4 py-2 text-white font-bold disabled:opacity-60"
              type="submit"
              disabled={submitting || !feedbackInput.trim()}
            >
              {submitting ? "Submitting…" : "Submit Feedback"}
            </button>
            {feedbackSuccess && <span className="text-green-400 text-sm">Thank you for your feedback!</span>}
            {feedbackError && <span className="text-red-400 text-sm">{feedbackError}</span>}
          </div>
        </form>
      </section>
    </div>
  );
}
