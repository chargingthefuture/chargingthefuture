"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ChymeMessage,
  ChymeParticipant,
  ChymeRoomResponse,
} from "@/src/lib/chyme/types";
import styles from "./chyme-shell.module.css";

type RequestState = "idle" | "loading" | "success" | "error";

type JoinResult = {
  streamChannelId: string;
  streamUserId: string;
};

function errorMessageFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

export function ChymeShell() {
  const [roomState, setRoomState] = useState<ChymeRoomResponse | null>(null);
  const [messages, setMessages] = useState<ChymeMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loadState, setLoadState] = useState<RequestState>("idle");
  const [chatState, setChatState] = useState<RequestState>("idle");
  const [joinState, setJoinState] = useState<RequestState>("idle");
  const [deleteState, setDeleteState] = useState<RequestState>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [joinResult, setJoinResult] = useState<JoinResult | null>(null);

  // Service Credits state
  const [serviceCreditsAmount, setServiceCreditsAmount] = useState("");
  const [serviceCreditsMessage, setServiceCreditsMessage] = useState("");
  const [serviceCreditsTarget, setServiceCreditsTarget] =
    useState<string | null>(null);
  const [serviceCreditsState, setServiceCreditsState] =
    useState<RequestState>("idle");
  const [serviceCreditsResult, setServiceCreditsResult] = useState<{
    amount: number;
    toUserId: string;
  } | null>(null);

  const roomParticipants: ChymeParticipant[] = useMemo(
    () => roomState?.participants ?? [],
    [roomState]
  );

  async function loadRoomAndMessages() {
    setLoadState("loading");
    setErrorText(null);

    try {
      const room = await parseJsonResponse<ChymeRoomResponse>(
        await fetch("/api/chyme/room", { cache: "no-store" })
      );
      const messagesResponse = await parseJsonResponse<{
        roomKey: string;
        messages: ChymeMessage[];
      }>(await fetch("/api/chyme/messages?limit=100", { cache: "no-store" }));

      setRoomState(room);
      setMessages(messagesResponse.messages);
      setLoadState("success");
    } catch (error) {
      setErrorText(errorMessageFromUnknown(error));
      setLoadState("error");
    }
  }

  async function handleSendMessage() {
    const trimmed = messageText.trim();
    if (trimmed.length === 0) {
      setErrorText("Message cannot be empty.");
      return;
    }

    setChatState("loading");
    setErrorText(null);

    try {
      const response = await parseJsonResponse<{
        ok: true;
        message: ChymeMessage;
      }>(
        await fetch("/api/chyme/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        })
      );

      setMessages((currentMessages) => [...currentMessages, response.message]);
      setMessageText("");
      setChatState("success");
    } catch (error) {
      setChatState("error");
      setErrorText(errorMessageFromUnknown(error));
    }
  }

  async function handleJoinCall() {
    setJoinState("loading");
    setErrorText(null);

    try {
      const response = await parseJsonResponse<{
        ok: true;
        streamChannelId: string;
        streamUserId: string;
      }>(
        await fetch("/api/chyme/join", {
          method: "POST",
        })
      );

      setJoinResult({
        streamChannelId: response.streamChannelId,
        streamUserId: response.streamUserId,
      });
      setRoomState((currentRoomState) => {
        if (!currentRoomState) {
          return currentRoomState;
        }
        return { ...currentRoomState, callActive: true };
      });
      setJoinState("success");
    } catch (error) {
      setJoinState("error");
      setErrorText(errorMessageFromUnknown(error));
    }
  }

  async function handleSendServiceCredits() {
    if (!serviceCreditsTarget || !serviceCreditsAmount) {
      setErrorText("Select a recipient and enter an amount.");
      return;
    }
    setServiceCreditsState("loading");
    setErrorText(null);
    try {
      const response = await parseJsonResponse<{
        transaction: { amount: number; toUserId: string };
      }>(
        await fetch("/api/chyme/service-credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toUserId: serviceCreditsTarget,
            amount: Number(serviceCreditsAmount),
            message: serviceCreditsMessage || undefined,
          }),
        })
      );
      setServiceCreditsResult(response.transaction);
      setServiceCreditsState("success");
      setServiceCreditsAmount("");
      setServiceCreditsMessage("");
      setServiceCreditsTarget(null);
    } catch (error) {
      setServiceCreditsState("error");
      setErrorText(errorMessageFromUnknown(error));
    }
  }

  async function handleDeleteChymeProfile() {
    setDeleteState("loading");
    setErrorText(null);

    try {
      await parseJsonResponse(
        await fetch("/api/account/chyme-profile", { method: "DELETE" })
      );
      setDeleteState("success");
      await loadRoomAndMessages();
    } catch (error) {
      setDeleteState("error");
      setErrorText(errorMessageFromUnknown(error));
    }
  }

  async function handleRequestFullAccountDeletion() {
    setDeleteState("loading");
    setErrorText(null);

    try {
      await parseJsonResponse(
        await fetch("/api/account/full-account", { method: "DELETE" })
      );
      setDeleteState("success");
    } catch (error) {
      setDeleteState("error");
      setErrorText(errorMessageFromUnknown(error));
    }
  }

  useEffect(() => {
    void loadRoomAndMessages();
  }, []);

  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerIcon}>CH</div>
            <div>
              <h1 className={styles.title}>Chyme</h1>
              <p className={styles.subtitle}>
                Community chat, calls, and connection hub
              </p>
            </div>
          </div>
          <nav className={styles.breadcrumb}>
            <a href="/" className={styles.breadcrumbLink}>
              Home
            </a>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span className={styles.breadcrumbCurrent}>Chyme</span>
          </nav>
        </header>

        {/* Error Alert */}
        {errorText && (
          <div className={styles.alert} role="alert">
            {errorText}
          </div>
        )}

        {/* Room Info */}
        <section className={styles.roomInfo}>
          <div className={styles.roomHeader}>
            <div className={styles.roomStatus}>
              <span
                className={`${styles.statusDot} ${loadState === "success" ? styles.statusDotActive : ""}`}
              />
              <span>
                {loadState === "loading"
                  ? "Connecting..."
                  : loadState === "success"
                    ? "Connected"
                    : "Offline"}
              </span>
            </div>
            <h2 className={styles.roomName}>
              {roomState?.roomName ?? "Loading..."}
            </h2>
          </div>
          <div className={styles.roomMeta}>
            <span>Room: {roomState?.roomKey ?? "..."}</span>
            <span className={styles.roomDivider}>|</span>
            <span>
              Call:{" "}
              {roomState?.callActive ? (
                <span className={styles.callActive}>Live</span>
              ) : (
                "Inactive"
              )}
            </span>
          </div>
        </section>

        {/* Main Content Grid */}
        <div className={styles.contentGrid}>
          {/* Chat Section */}
          <section className={styles.chatSection}>
            <div className={styles.chatHeader}>
              <h3>Community Chat</h3>
              <span className={styles.messageCount}>
                {messages.length} messages
              </span>
            </div>
            <div className={styles.messageList}>
              {messages.length === 0 ? (
                <div className={styles.emptyChat}>
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={styles.message}>
                    <div className={styles.messageAvatar}>
                      {message.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.messageContent}>
                      <span className={styles.messageName}>
                        {message.displayName}
                      </span>
                      <p className={styles.messageText}>{message.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className={styles.chatInput}>
              <input
                type="text"
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
                maxLength={1000}
                className={styles.input}
              />
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={chatState === "loading"}
                className={styles.sendButton}
              >
                {chatState === "loading" ? "..." : "Send"}
              </button>
            </div>
          </section>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            {/* Participants */}
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>
                Participants ({roomParticipants.length})
              </h3>
              <ul className={styles.participantList}>
                {roomParticipants.map((participant) => (
                  <li key={participant.userId} className={styles.participant}>
                    <div className={styles.participantAvatar}>
                      {participant.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.participantInfo}>
                      <span className={styles.participantName}>
                        {participant.displayName}
                      </span>
                      <span className={styles.participantRole}>
                        {participant.role}
                      </span>
                    </div>
                  </li>
                ))}
                {roomParticipants.length === 0 && (
                  <li className={styles.emptyState}>No participants yet</li>
                )}
              </ul>
            </section>

            {/* Call Section */}
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Voice Call</h3>
              {joinResult ? (
                <div className={styles.callInfo}>
                  <p className={styles.callConnected}>Connected</p>
                  <p className={styles.callMeta}>
                    Channel: {joinResult.streamChannelId.slice(0, 8)}...
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleJoinCall()}
                  disabled={joinState === "loading"}
                  className={styles.callButton}
                >
                  {joinState === "loading" ? "Joining..." : "Join Call"}
                </button>
              )}
            </section>

            {/* Service Credits */}
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Send Credits</h3>
              <div className={styles.creditsForm}>
                <select
                  value={serviceCreditsTarget || ""}
                  onChange={(e) =>
                    setServiceCreditsTarget(e.target.value || null)
                  }
                  className={styles.select}
                >
                  <option value="">Select recipient</option>
                  {roomParticipants
                    .filter(
                      (p) => p.userId !== roomState?.participants?.[0]?.userId
                    )
                    .map((p) => (
                      <option key={p.userId} value={p.userId}>
                        {p.displayName}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Amount"
                  value={serviceCreditsAmount}
                  onChange={(e) => setServiceCreditsAmount(e.target.value)}
                  className={styles.input}
                />
                <button
                  type="button"
                  onClick={() => void handleSendServiceCredits()}
                  disabled={serviceCreditsState === "loading"}
                  className={styles.creditsButton}
                >
                  {serviceCreditsState === "loading" ? "..." : "Send"}
                </button>
              </div>
              {serviceCreditsState === "success" && serviceCreditsResult && (
                <p className={styles.successMessage}>
                  Sent {serviceCreditsResult.amount} credits!
                </p>
              )}
            </section>
          </aside>
        </div>

        {/* Account Actions */}
        <section className={styles.dangerZone}>
          <h3 className={styles.dangerTitle}>Account Management</h3>
          <p className={styles.dangerText}>
            These actions are irreversible. Please proceed with caution.
          </p>
          <div className={styles.dangerActions}>
            <button
              type="button"
              onClick={() => void handleDeleteChymeProfile()}
              disabled={deleteState === "loading"}
              className={styles.dangerButton}
            >
              Delete Chyme Data
            </button>
            <button
              type="button"
              onClick={() => void handleRequestFullAccountDeletion()}
              disabled={deleteState === "loading"}
              className={styles.dangerButtonStrong}
            >
              Delete Full Account
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
