"use client";

import { MessageCircle } from "lucide-react";
import { StreamChatPanel } from "../shared/stream-chat-panel";
import { COLOR, FAINT, SUBTLE, type SrChatCredentials, type SrFulfillment, type SrResolveOutcome } from "./sr-shared";

const RESOLVE_ACTIONS: { outcome: SrResolveOutcome; label: string; color: string }[] = [
  { outcome: "successful", label: "Mark successful", color: "#22C55E" },
  { outcome: "no_longer_needed", label: "No longer needed", color: SUBTLE },
  { outcome: "unsuccessful_reopen", label: "Didn't work — reopen for others", color: "#FBBF24" },
  { outcome: "unsuccessful_close", label: "Didn't work — close", color: "#EF4444" },
];

function fulfillmentTitle(f: SrFulfillment): string {
  return f.requestTitle && f.requestTitle.trim().length > 0 ? f.requestTitle : `Request ${f.id.slice(0, 8)}`;
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
  if (selected.status !== "active") {
    return (
      <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: SUBTLE }}>
        This request is {selected.requestStatus === "open" ? "open again" : "closed"}.
      </div>
    );
  }
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
  if (!selected) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: FAINT, fontSize: 14 }}>Pick a conversation on the left.</div>;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#F0FDF4" }}>{fulfillmentTitle(selected)}</div>
        <div style={{ fontSize: 12, color: SUBTLE }}>{isRequester ? "Your request — you're talking with the helper." : "You offered to help — talking with the requester."}</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {chatLoading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: SUBTLE, fontSize: 14 }}>Loading chat…</div>
        ) : chatError ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14 }}>{chatError}</div>
        ) : chatCredentials?.streamApiKey && chatCredentials.streamChannelId ? (
          <StreamChatPanel
            streamApiKey={chatCredentials.streamApiKey}
            streamToken={chatCredentials.streamToken as string}
            streamUserId={chatCredentials.streamUserId as string}
            streamChannelId={chatCredentials.streamChannelId}
          />
        ) : (
          <div style={{ flex: 1 }} />
        )}
      </div>
      <ResolveBar selected={selected} isRequester={isRequester} resolving={resolving} onResolve={onResolve} />
    </div>
  );
}

export function SocketRelayChat({
  fulfillments,
  selected,
  currentUserId,
  resolving = false,
  onSelect,
  onResolve,
  chatLoading,
  chatError,
  chatCredentials,
}: {
  fulfillments: SrFulfillment[];
  selected: SrFulfillment | null;
  currentUserId?: string;
  resolving?: boolean;
  onSelect: (fulfillment: SrFulfillment) => void;
  onResolve: (fulfillmentId: string, outcome: SrResolveOutcome) => void;
  chatLoading: boolean;
  chatError: string | null;
  chatCredentials: SrChatCredentials | null;
}) {
  if (fulfillments.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px dashed ${COLOR}4D`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MessageCircle size={20} style={{ color: `${COLOR}66` }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No conversations yet</div>
        <div style={{ fontSize: 13, color: FAINT, textAlign: "center", maxWidth: 320, lineHeight: 1.5 }}>
          When you offer to help on a request — or someone offers to help with yours — a private Direct Line opens here.
        </div>
      </div>
    );
  }

  const selectedIsRequester = Boolean(selected && currentUserId && selected.requesterUserId === currentUserId);

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <div style={{ width: 240, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "12px 8px", overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>Conversations</div>
        {fulfillments.map((f) => {
          const isRequester = Boolean(currentUserId && f.requesterUserId === currentUserId);
          return (
            <button key={f.id} type="button" aria-pressed={selected?.id === f.id} onClick={() => onSelect(f)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: selected?.id === f.id ? `${COLOR}18` : "transparent", border: selected?.id === f.id ? `1px solid ${COLOR}30` : "1px solid transparent", marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fulfillmentTitle(f)}</div>
              <div style={{ fontSize: 11, color: SUBTLE }}>{isRequester ? "Your request" : "You're helping"} · <span style={{ textTransform: "capitalize" }}>{f.status}</span></div>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ChatPane
          selected={selected}
          isRequester={selectedIsRequester}
          resolving={resolving}
          onResolve={onResolve}
          chatLoading={chatLoading}
          chatError={chatError}
          chatCredentials={chatCredentials}
        />
      </div>
    </div>
  );
}
