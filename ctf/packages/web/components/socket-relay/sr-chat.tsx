"use client";

import { ChevronLeft, Clock, MessageCircle } from "lucide-react";
import { MarkRecurringControl } from "@/components/shared/mark-recurring-control";
import { StreamChatPanel } from "../shared/stream-chat-panel";
import { FAINT, SUBTLE, srCounterpartLabel, type SrChatCredentials, type SrDirectLine, type SrFulfillment, type SrResolveOutcome } from "./sr-shared";
import { useTheme } from '@/hooks/useTheme';
import { getSocketRelayTokens } from './sr-shared';

const RESOLVE_ACTIONS: { outcome: SrResolveOutcome; label: string; color: string }[] = [
  { outcome: "successful", label: "Mark successful", color: "#22C55E" },
  { outcome: "no_longer_needed", label: "No longer needed", color: SUBTLE },
  { outcome: "unsuccessful_reopen", label: "Didn't work — reopen for others", color: "#FBBF24" },
  { outcome: "unsuccessful_close", label: "Didn't work — close", color: "#EF4444" },
];

function fulfillmentTitle(f: SrFulfillment): string {
  return f.requestTitle && f.requestTitle.trim().length > 0 ? f.requestTitle : `Request ${f.id.slice(0, 8)}`;
}

// Why the composer is gone on a past conversation. A Direct Line closes for good at a terminal state
// (rule 100) — there is no reopen. Without this, a member typed into the still-visible composer and
// the send failed "Unauthorized" with no explanation (owner report). The canceled-but-open case also
// says what TO do: a fresh offer opens a fresh Direct Line.
function readOnlyNotice(f: SrFulfillment): string | null {
  if (f.status === "active") return null;
  if (f.status === "canceled") {
    return f.requestStatus === "open"
      ? "This conversation ended when the offer was canceled and can't be reopened. The request is open again on the feed — a new offer starts a new Direct Line."
      : "This conversation ended when the offer was canceled and can't be reopened.";
  }
  return "This conversation ended when the request closed. You can still read it, but no new messages can be sent.";
}

function ResolveBar({
  selected,
  isRequester,
  resolving,
  onResolve,
}: {
  selected: SrFulfillment;
  isRequester: boolean;
  resolving: boolean;
  onResolve: (fulfillmentId: string, outcome: SrResolveOutcome) => void;
}) {
  // A past conversation gets its explanation where the composer used to be (readOnlyNotice in the
  // chat panel), so no second footer line is needed here.
  if (selected.status !== "active") return null;
  if (!isRequester) {
    return (
      <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: SUBTLE }}>
        Only the person who posted this request can close it. Work it out here on the Direct Line.
      </div>
    );
  }
  return (
    <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexWrap: "wrap", gap: 8 }}>
      {RESOLVE_ACTIONS.map((a) => (
        <button
          key={a.outcome}
          type="button"
          disabled={resolving}
          onClick={() => onResolve(selected.id, a.outcome)}
          style={{ padding: "6px 12px", borderRadius: 8, background: `${a.color}14`, border: `1px solid ${a.color}40`, color: a.color, fontSize: 12, fontWeight: 600, cursor: resolving ? "not-allowed" : "pointer", opacity: resolving ? 0.6 : 1 }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

// The right pane for a pending request: it has no helper yet, so there is nothing to chat on. Explain
// what happens next instead of showing an empty chat.
function PendingPane({ title }: { title: string }) {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#F0FDF4" }}>{title}</div>
        <div style={{ fontSize: 12, color: SUBTLE }}>Waiting for a helper to offer.</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32, textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px dashed ${t.ACCENT}4D`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Clock size={20} style={{ color: `${t.ACCENT}99` }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.SUBTLE }}>No helper yet</div>
        <div style={{ fontSize: 13, color: FAINT, maxWidth: 320, lineHeight: 1.5 }}>
          This request is still open on the feed. As soon as someone offers to help, your Direct Line opens here and you can talk it through.
        </div>
      </div>
    </div>
  );
}

/**
 * "Is this ongoing?" under a favor conversation. A favor is often not a one-off — the same neighbor
 * collects the same prescription every month. Shown on the live conversation as well as on one closed
 * successfully, because that is where the relationship is and the member usually knows it is standing
 * while it is happening. Not on a canceled or unsuccessful close: that is not an arrangement. Its own
 * component so ChatPane stays a layout, not a decision tree (rule 116).
 */
function FavorRecurringPrompt({
  selected,
  isRequester,
  accent,
}: {
  selected: SrFulfillment;
  isRequester: boolean;
  accent: string;
}) {
  const isStandingCandidate =
    selected.status === "active" || (selected.status === "closed" && selected.closeReason === "successful");
  if (!isStandingCandidate) return null;
  return (
    <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <MarkRecurringControl
        counterpartyUserId={isRequester ? selected.fulfillerUserId : selected.requesterUserId}
        counterpartyName={isRequester ? selected.fulfillerUsername : selected.requesterUsername}
        originPlugin="socket-relay"
        sector="favor"
        sectorLabel="a favor like this one"
        accent={accent}
      />
    </div>
  );
}

function ChatPane({
  selected,
  isRequester,
  resolving,
  onResolve,
  chatLoading,
  chatError,
  chatCredentials,
}: {
  selected: SrFulfillment | null;
  isRequester: boolean;
  resolving: boolean;
  onResolve: (fulfillmentId: string, outcome: SrResolveOutcome) => void;
  chatLoading: boolean;
  chatError: string | null;
  chatCredentials: SrChatCredentials | null;
}) {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  if (!selected) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: FAINT, fontSize: 14 }}>Pick a conversation.</div>;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#F0FDF4" }}>{fulfillmentTitle(selected)}</div>
        {/* Names the other person. The old line said "you're talking with the helper" without ever
            saying who the helper was, and kept saying it on a canceled conversation where nobody is
            talking — so a request owner could open a past line and still not learn who had offered
            (owner report). Falls back to the old wording only when the member has no name and no
            handle on file. */}
        <div style={{ fontSize: 12, color: SUBTLE }}>{counterpartHeadline(selected, isRequester)}</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {chatLoading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: SUBTLE, fontSize: 14 }}>Loading chat…</div>
        ) : chatError ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14 }}>{chatError}</div>
        ) : chatCredentials?.streamApiKey &&
          chatCredentials.streamToken &&
          chatCredentials.streamUserId &&
          chatCredentials.streamChannelId ? (
          <StreamChatPanel
            streamApiKey={chatCredentials.streamApiKey}
            streamToken={chatCredentials.streamToken}
            streamUserId={chatCredentials.streamUserId}
            streamChannelId={chatCredentials.streamChannelId}
            accentColor={t.ACCENT}
            readOnlyNotice={readOnlyNotice(selected)}
          />
        ) : (
          <div style={{ flex: 1 }} />
        )}
      </div>
      <FavorRecurringPrompt selected={selected} isRequester={isRequester} accent={t.ACCENT} />
      <ResolveBar selected={selected} isRequester={isRequester} resolving={resolving} onResolve={onResolve} />
    </div>
  );
}

// A single row in the left conversation list. A fulfillment row is a live conversation; a pending row
// is a request you posted that no one has claimed yet (shown with a muted "waiting" sub-label).
function DirectLineRow({
  line,
  active,
  currentUserId,
  onSelect,
}: {
  line: SrDirectLine;
  active: boolean;
  currentUserId?: string;
  onSelect: (line: SrDirectLine) => void;
}) {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  const title = line.kind === "fulfillment" ? fulfillmentTitle(line.fulfillment) : line.request.title;
  const isRequester = line.kind === "fulfillment" && Boolean(currentUserId && line.fulfillment.requesterUserId === currentUserId);
  const sub =
    line.kind === "pending" ? (
      "Your request · Waiting for a helper"
    ) : (
      <>
        {/* Names the other person in the list too, so a request owner can see who offered without
            opening each conversation one at a time. */}
        {isRequester ? "Your request" : "You're helping"}
        {srCounterpartLabel(line.fulfillment, isRequester)
          ? ` · ${srCounterpartLabel(line.fulfillment, isRequester)}`
          : ""}{" "}
        · <span style={{ textTransform: "capitalize" }}>{line.fulfillment.status}</span>
      </>
    );
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(line)}
      style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: active ? `${t.ACCENT}18` : "transparent", border: active ? `1px solid ${t.ACCENT}30` : "1px solid transparent", marginBottom: 4 }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: t.TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
      <div style={{ fontSize: 11, color: SUBTLE }}>{sub}</div>
    </button>
  );
}

// The header's second line: the viewer's role, who the other person is, and — when the conversation
// is no longer live — that it ended. Kept out of the component so its branches stay off the chat's
// complexity budget.
function counterpartHeadline(f: SrFulfillment, isRequester: boolean): string {
  const role = isRequester ? "Your request" : "You offered to help";
  const who = srCounterpartLabel(f, isRequester);
  const other = who
    ? `${isRequester ? "Helper" : "Requester"}: ${who}`
    : isRequester
      ? "with the helper"
      : "with the requester";
  const ended = f.status === "canceled" ? " · Canceled" : f.status === "closed" ? " · Closed" : "";
  return `${role} · ${other}${ended}`;
}

export function SocketRelayChat({
  directLines,
  selected,
  currentUserId,
  resolving = false,
  onSelect,
  onBack,
  onResolve,
  chatLoading,
  chatError,
  chatCredentials,
}: {
  directLines: SrDirectLine[];
  selected: SrDirectLine | null;
  currentUserId?: string;
  resolving?: boolean;
  onSelect: (line: SrDirectLine) => void;
  // Clear the selection and return to the conversation list (the app is phone-width only, so the list
  // and the open conversation are separate full-width views, not a side-by-side split).
  onBack: () => void;
  onResolve: (fulfillmentId: string, outcome: SrResolveOutcome) => void;
  chatLoading: boolean;
  chatError: string | null;
  chatCredentials: SrChatCredentials | null;
}) {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  if (directLines.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px dashed ${t.ACCENT}4D`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MessageCircle size={20} style={{ color: `${t.ACCENT}66` }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.SUBTLE }}>No Direct Lines yet</div>
        <div style={{ fontSize: 13, color: FAINT, textAlign: "center", maxWidth: 320, lineHeight: 1.5 }}>
          Post a request or offer to help on one, and it shows up here as a private Direct Line.
        </div>
      </div>
    );
  }

  const selectedFulfillment = selected?.kind === "fulfillment" ? selected.fulfillment : null;
  const selectedIsRequester = Boolean(selectedFulfillment && currentUserId && selectedFulfillment.requesterUserId === currentUserId);

  // Single phone-width column (rule 105): show the conversation list, or — once a row is picked — the
  // open conversation full-width with a Back control, rather than a cramped side-by-side split.
  if (!selected) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto", padding: "12px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 4px", marginBottom: 8 }}>Conversations</div>
        {directLines.map((line) => (
          <DirectLineRow key={line.key} line={line} active={false} currentUserId={currentUserId} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <button
        type="button"
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 12px", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
      >
        <ChevronLeft size={16} /> All conversations
      </button>
      {selected.kind === "pending" ? (
        <PendingPane title={selected.request.title} />
      ) : (
        <ChatPane
          selected={selectedFulfillment}
          isRequester={selectedIsRequester}
          resolving={resolving}
          onResolve={onResolve}
          chatLoading={chatLoading}
          chatError={chatError}
          chatCredentials={chatCredentials}
        />
      )}
    </div>
  );
}
