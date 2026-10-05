"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, Send } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { PEER_PROGRAMMING_MAX_MESSAGE_LENGTH } from "@/lib/peer-programming/constants";
import { getPeerProgrammingTokens, initials, type Message, type Room } from "./pp-shared";

// Message stamp: date + time, not time alone — without the date, messages from different days (e.g.
// an 08:43 AM and a 04:36 PM) can't be told apart.
function formatMessageTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function MessageRow({ msg }: { msg: Message }) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  const time = msg.timestamp ? formatMessageTimestamp(msg.timestamp) : "";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: `${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, color: t.ACCENT, fontWeight: 700 }}>
        {initials(msg.author || "?")}
      </div>
      <div style={{ maxWidth: "70%" }}>
        <div style={{ fontSize: 11, color: t.MUTED, marginBottom: 3 }}>{msg.author || "Anonymous"} · {time}</div>
        <div style={{ padding: "10px 14px", borderRadius: "12px 12px 12px 4px", background: "rgba(255,255,255,0.05)", border: `1px solid ${t.BORDER}`, fontSize: 14, lineHeight: 1.6, color: t.TEXT }}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

// Composer box sizing: one line to start, grows to six, then scrolls inside itself.
const COMPOSER_LINE_HEIGHT_PX = 20;
const COMPOSER_MAX_LINES = 6;
const COMPOSER_PADDING_Y_PX = 6;

// The message composer (input + send). Shown only to cohort members while the cohort is live.
function ChatComposer({
  messageInput,
  onMessageInput,
  onSend,
  submitting,
  postError,
}: {
  messageInput: string;
  onMessageInput: (v: string) => void;
  onSend: () => void;
  submitting: boolean;
  postError: string | null;
}) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  const canSend = messageInput.trim().length > 0 && !submitting;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Grow the box with the text, up to COMPOSER_MAX_LINES lines, then scroll inside it. Re-measured on
  // every change so it also shrinks back to one line after a send clears it.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = COMPOSER_LINE_HEIGHT_PX * COMPOSER_MAX_LINES + COMPOSER_PADDING_Y_PX * 2;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [messageInput]);
  return (
    <div style={{ padding: "8px 24px 20px", flexShrink: 0 }}>
      {postError && (
        <div role="alert" style={{ marginBottom: 8, fontSize: 13, color: "#EF4444" }}>
          {postError}
        </div>
      )}
      {/* alignItems flex-end keeps the send button on the bottom edge as the box grows. */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, padding: "10px 16px", background: t.INPUT_BG, border: `1px solid ${t.BORDER_HI}`, borderRadius: 14 }}>
        <textarea
          ref={inputRef}
          rows={1}
          aria-label="Message your cohort"
          value={messageInput}
          maxLength={PEER_PROGRAMMING_MAX_MESSAGE_LENGTH}
          onChange={(e) => onMessageInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Message your cohort…"
          disabled={submitting}
          // 16px so iOS Safari does not zoom the page on focus; pre-wrap so long text wraps instead of
          // scrolling sideways out of view.
          style={{ flex: 1, minWidth: 0, minHeight: 32, padding: `${COMPOSER_PADDING_Y_PX}px 0`, boxSizing: "border-box", background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 16, lineHeight: `${COMPOSER_LINE_HEIGHT_PX}px`, fontFamily: "inherit", whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: t.TEXT }}
        />
        <button type="button" aria-label="Send" onClick={onSend} disabled={!canSend} style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, background: canSend ? t.ACCENT : t.BORDER, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: canSend ? "pointer" : "not-allowed" }}>
          <Send size={14} style={{ color: canSend ? "#fff" : t.FAINT }} />
        </button>
      </div>
    </div>
  );
}

// A one-line notice that replaces the composer when the viewer can't post.
function ChatNotice({ color, children }: { color: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  return (
    <div style={{ padding: "12px 24px", borderTop: `1px solid ${t.BORDER}`, background: "rgba(255,255,255,0.02)", textAlign: "center", color, fontSize: 13 }}>
      {children}
    </div>
  );
}

// Decides what sits below the message list: a notice (no cohort / ended / listening in) or the
// composer. Early returns keep each branch flat and behavior-identical to the old nested ternary.
function ChatFooter({
  hasCohort,
  ended,
  readOnly,
  messageInput,
  onMessageInput,
  onSend,
  submitting,
  postError,
}: {
  hasCohort: boolean;
  ended: boolean;
  readOnly: boolean;
  messageInput: string;
  onMessageInput: (v: string) => void;
  onSend: () => void;
  submitting: boolean;
  postError: string | null;
}) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  if (!hasCohort) return <ChatNotice color={t.MUTED}>Join a cohort to participate in chat</ChatNotice>;
  if (ended) return <ChatNotice color={t.SUBTLE}>This cohort has ended — the conversation is read-only.</ChatNotice>;
  if (readOnly) return <ChatNotice color={t.SUBTLE}>You’re listening in — only cohort members can post here.</ChatNotice>;
  return (
    <ChatComposer
      messageInput={messageInput}
      onMessageInput={onMessageInput}
      onSend={onSend}
      submitting={submitting}
      postError={postError}
    />
  );
}

export function PeerProgrammingChatTab({
  room,
  messages,
  messageInput,
  onMessageInput,
  onSend,
  submitting,
  postError = null,
  readOnly = false,
  ended = false,
}: {
  room: Room | null;
  messages: Message[];
  messageInput: string;
  onMessageInput: (v: string) => void;
  onSend: () => void;
  submitting: boolean;
  // Why the last post failed (the route's reason), shown above the composer. Null when it did not.
  postError?: string | null;
  // True when the viewer is listening in (or an admin viewing another cohort): the chat is visible
  // but the composer is replaced by a notice, since only cohort members can post.
  readOnly?: boolean;
  // True when the cohort itself has ended: the Direct Line is frozen for everyone (read-only history).
  ended?: boolean;
}) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const hasCohort = Boolean(room?.cohortId);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: t.SUBTLE, marginTop: 40 }}>
            <MessageSquare size={32} style={{ color: t.ACCENT, opacity: 0.5, display: "block", margin: "0 auto 8px" }} />
            <div style={{ fontSize: 15 }}>No messages yet. Start the conversation!</div>
          </div>
        ) : (
          messages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
        )}
        <div ref={endRef} />
      </div>
      <ChatFooter
        hasCohort={hasCohort}
        ended={ended}
        readOnly={readOnly}
        messageInput={messageInput}
        onMessageInput={onMessageInput}
        onSend={onSend}
        submitting={submitting}
        postError={postError}
      />
    </div>
  );
}
