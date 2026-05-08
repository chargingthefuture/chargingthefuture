"use client";

import { useEffect, useState } from "react";

type Topic = {
  id: string;
  weekStartDate: string;
  title: string;
  guidance: string;
  status: string;
};

type Cohort = {
  id: string;
  weekStartDate: string;
  cohortLabel: string;
  fallbackOpen: boolean;
  topicId: string | null;
};

type Message = {
  id: string;
  cohortId: string;
  authorUserId: string;
  body: string;
  tier: string;
  createdAtIso: string;
};

export function PeerProgrammingShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchRoom() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/peer-programming/room", {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to load room");
        const data = await res.json();
        if (controller.signal.aborted) return;
        setTopic(data.topic ?? null);
        setCohort(data.cohort ?? null);
        setMessages(data.messages ?? []);
      } catch (e: any) {
        if (e.name === "AbortError" || controller.signal.aborted) return;
        setError(e.message || "Failed to load peer programming data.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchRoom();
    return () => controller.abort();
  }, []);

  async function handlePostMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!messageInput.trim() || !cohort) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/peer-programming/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ cohortId: cohort.id, body: messageInput }),
      });
      if (!res.ok) throw new Error("Failed to post message");
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setMessageInput("");
    } catch (e: any) {
      setError(e.message || "Failed to post message.");
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
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          cohortId: cohort?.id ?? null,
          issueType: "general",
          suggestionCategory: "experience",
          releaseSurface: "web",
          note: feedbackInput,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit feedback");
      setFeedbackSuccess(true);
      setFeedbackInput("");
    } catch (e: any) {
      setFeedbackError(e.message || "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading peer programming…
      </div>
    );
  if (error) return <div className="text-red-500 p-4">{error}</div>;

  if (!cohort) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Peer Programming</h2>
        <p className="text-muted-foreground">
          You&apos;re not assigned to a cohort this week. Assignments happen every Monday.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      {/* Topic */}
      {topic && (
        <section className="rounded-lg border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Week of {topic.weekStartDate}
          </p>
          <h2 className="text-xl font-bold mb-2">{topic.title}</h2>
          <p className="text-sm text-muted-foreground">{topic.guidance}</p>
        </section>
      )}

      {/* Cohort info */}
      <section className="rounded-lg border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Your Cohort
        </h3>
        <p className="font-medium">{cohort.cohortLabel}</p>
        {cohort.fallbackOpen && (
          <p className="text-xs text-muted-foreground mt-1">
            Open session — all authenticated members can join
          </p>
        )}
      </section>

      {/* Messages */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Discussion</h3>
        <div className="overflow-y-auto max-h-72 rounded-lg border bg-card p-3 mb-3 space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id}>
                <p className="text-xs text-muted-foreground mb-0.5">
                  {new Date(msg.createdAtIso).toLocaleString()}
                </p>
                <p className="text-sm">{msg.body}</p>
              </div>
            ))
          )}
        </div>
        <form className="flex gap-2" onSubmit={handlePostMessage}>
          <input
            className="flex-1 rounded border px-3 py-2 text-sm bg-background"
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type your message…"
            disabled={submitting}
            required
          />
          <button
            className="rounded bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60"
            type="submit"
            disabled={submitting || !messageInput.trim()}
          >
            {submitting ? "Sending…" : "Send"}
          </button>
        </form>
      </section>

      {/* Feedback */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Session Feedback</h3>
        <form className="space-y-3" onSubmit={handleSubmitFeedback}>
          <textarea
            className="w-full rounded border px-3 py-2 text-sm bg-background"
            value={feedbackInput}
            onChange={(e) => setFeedbackInput(e.target.value)}
            placeholder="How was your peer programming experience?"
            rows={3}
            disabled={submitting || feedbackSuccess}
            required
          />
          <div className="flex items-center gap-3">
            <button
              className="rounded bg-green-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
              type="submit"
              disabled={submitting || !feedbackInput.trim() || feedbackSuccess}
            >
              {submitting ? "Submitting…" : "Submit Feedback"}
            </button>
            {feedbackSuccess && (
              <span className="text-green-500 text-sm">
                Thank you for your feedback!
              </span>
            )}
            {feedbackError && (
              <span className="text-red-500 text-sm">{feedbackError}</span>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
