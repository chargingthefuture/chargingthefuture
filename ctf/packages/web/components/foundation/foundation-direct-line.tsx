"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { MarkRecurringControl } from "@/components/shared/mark-recurring-control";
import { StreamChatPanel } from "@/components/shared/stream-chat-panel";
import { useTheme } from "@/hooks/useTheme";
import { FONT, getFoundationTokens } from "./foundation-ui";

// Stream credentials a member needs to connect to one connection thread's Direct Line channel.
export interface DirectLineCredentials {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
}

// Shared frame for the Direct Line: a back control, the "Direct Line" heading with an optional
// subtitle (who the conversation is with), and the live chat panel. Both the post-Request-Quote
// landing and the re-open-from-Quotes flow render through this so the surface is identical.
function DirectLineFrame({
  subtitle, onBack, counterpartyUserId, children,
}: {
  subtitle?: string | null;
  onBack: () => void;
  // The provider on this thread, passed only when the viewer is the survivor. Absent on the provider's
  // own view and whenever the other party is not known, in which case no prompt is shown.
  counterpartyUserId?: string | null;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: t.BG, fontFamily: FONT, color: t.TITLE }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${t.ACCENT}20`, flexShrink: 0 }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{ width: 36, height: 36, borderRadius: 10, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, cursor: "pointer", flexShrink: 0 }}
        >
          <ChevronLeft size={20} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>Direct Line</div>
          {subtitle ? <div style={{ fontSize: 12, color: t.SUBTLE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div> : null}
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      {/* A Foundation thread IS the ongoing relationship — the spec's intended prompt point. Shown to
          the survivor side (the side that would keep calling the same provider); the provider does not
          see it on their own thread. */}
      {counterpartyUserId ? (
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${t.BORDER}` }}>
          <MarkRecurringControl
            counterpartyUserId={counterpartyUserId}
            originPlugin="foundation"
            sector="service"
            sectorLabel="ongoing work with this provider"
            accent={t.ACCENT}
          />
        </div>
      ) : null}
    </div>
  );
}

// The Direct Line opened straight after a successful Request Quote, using the credentials the thread
// POST already returned — no extra round trip needed.
export function DirectLineFromQuote({
  credentials, subtitle, onBack, counterpartyUserId,
}: {
  credentials: DirectLineCredentials;
  subtitle?: string | null;
  onBack: () => void;
  counterpartyUserId?: string | null;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  return (
    <DirectLineFrame subtitle={subtitle} onBack={onBack} counterpartyUserId={counterpartyUserId}>
      <StreamChatPanel
        streamApiKey={credentials.streamApiKey}
        streamToken={credentials.streamToken}
        streamUserId={credentials.streamUserId}
        streamChannelId={credentials.streamChannelId}
        accentColor={t.ACCENT}
      />
    </DirectLineFrame>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; credentials: DirectLineCredentials };

// Re-open a Direct Line for an existing thread from the Quotes tab. It fetches fresh Stream
// credentials from the token route (which checks the caller is a participant) and renders the panel,
// with explicit loading / error / not-a-participant states.
export function DirectLineFromThread({
  threadId, subtitle, onBack, counterpartyUserId,
}: {
  threadId: string;
  subtitle?: string | null;
  onBack: () => void;
  counterpartyUserId?: string | null;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    fetch(`/api/foundation/connections/threads/${encodeURIComponent(threadId)}/token`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          code?: string;
          streamApiKey?: string;
          streamToken?: string;
          streamUserId?: string;
          streamChannelId?: string;
        };
        if (!active) return;
        if (res.ok && body.ok && body.streamApiKey && body.streamToken && body.streamUserId && body.streamChannelId) {
          setState({
            status: "ready",
            credentials: {
              streamApiKey: body.streamApiKey,
              streamToken: body.streamToken,
              streamUserId: body.streamUserId,
              streamChannelId: body.streamChannelId,
            },
          });
          return;
        }
        const message =
          body.code === "FOUNDATION_NOT_THREAD_PARTICIPANT"
            ? "You don't have access to this Direct Line."
            : body.code === "FOUNDATION_STREAM_UNAVAILABLE"
              ? "The Direct Line is temporarily unavailable. Try again shortly."
              : "Could not open this Direct Line.";
        setState({ status: "error", message });
      })
      .catch(() => {
        if (active) setState({ status: "error", message: "Could not open this Direct Line." });
      });
    return () => {
      active = false;
    };
  }, [threadId]);

  return (
    <DirectLineFrame subtitle={subtitle} onBack={onBack} counterpartyUserId={counterpartyUserId}>
      {state.status === "loading" && (
        <div style={{ padding: 24, color: t.SUBTLE, fontSize: 14 }}>Opening Direct Line…</div>
      )}
      {state.status === "error" && (
        <div style={{ padding: 24, color: "#EF4444", fontSize: 14 }}>{state.message}</div>
      )}
      {state.status === "ready" && (
        <StreamChatPanel
          streamApiKey={state.credentials.streamApiKey}
          streamToken={state.credentials.streamToken}
          streamUserId={state.credentials.streamUserId}
          streamChannelId={state.credentials.streamChannelId}
          accentColor={t.ACCENT}
        />
      )}
    </DirectLineFrame>
  );
}
