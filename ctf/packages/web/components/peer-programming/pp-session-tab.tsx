"use client";

import { useState } from "react";
import { Video } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/useTheme";
import { getPeerProgrammingTokens, initials, type Participant, type Room } from "./pp-shared";
import { PeerProgrammingSessionCall, type PeerProgrammingSessionCredentials } from "./pp-session-call";

// Shape of the JSON returned by POST /api/peer-programming/session/join. Every field is optional
// until validated, and the body may fail to parse (null).
type JoinResponse = (Partial<PeerProgrammingSessionCredentials> & { message?: string }) | null;

// The four Stream fields the live call cannot start without.
type StreamRequiredFields = Pick<
  PeerProgrammingSessionCredentials,
  "streamApiKey" | "streamCallId" | "streamUserId" | "streamToken"
>;

// Type guard: true only when all four Stream credentials are present, narrowing them to non-optional.
function hasStreamFields(data: JoinResponse): data is JoinResponse & StreamRequiredFields {
  return Boolean(
    data && data.streamApiKey && data.streamCallId && data.streamToken && data.streamUserId,
  );
}

// Calls the join endpoint and returns ready-to-use call credentials, throwing with the server's
// message (or a generic one) if the request fails or the response is missing Stream fields.
async function requestSessionCredentials(
  fallbackCohortId: string,
): Promise<PeerProgrammingSessionCredentials> {
  const res = await fetch("/api/peer-programming/session/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
  });
  const data = (await res.json().catch(() => null)) as JoinResponse;
  if (!res.ok || !hasStreamFields(data)) {
    throw new Error(data?.message ?? "Could not start the live session.");
  }
  return {
    cohortId: data.cohortId ?? fallbackCohortId,
    displayName: data.displayName ?? "Member",
    streamApiKey: data.streamApiKey,
    streamCallId: data.streamCallId,
    streamUserId: data.streamUserId,
    streamToken: data.streamToken,
  };
}

// The pre-join card: video placeholder, cohort/error notices, and the Join Session button.
function SessionJoinCard({
  hasCohort,
  joining,
  error,
  onJoin,
}: {
  hasCohort: boolean;
  joining: boolean;
  error: string | null;
  onJoin: () => void;
}) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  return (
    <div style={{ padding: "60px 0", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}30`, textAlign: "center", marginBottom: 20 }}>
      <Video size={48} style={{ color: t.ACCENT, display: "block", margin: "0 auto 12px" }} />
      <div style={{ fontSize: 16, color: t.MUTED, marginBottom: 4 }}>Video session</div>
      {!hasCohort && <div style={{ fontSize: 13, color: t.FAINT }}>Join a cohort to access live sessions</div>}
      {error && <div style={{ fontSize: 13, color: "#F87171", marginTop: 8 }}>{error}</div>}
      {hasCohort && (
        <button
          type="button"
          onClick={onJoin}
          disabled={joining}
          style={{ marginTop: 16, padding: "12px 32px", borderRadius: 10, background: t.ACCENT, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: joining ? "default" : "pointer", opacity: joining ? 0.6 : 1 }}
        >
          {joining ? "Connecting…" : "Join Session"}
        </button>
      )}
    </div>
  );
}

// The roster grid shown before joining. Renders nothing when the cohort has no participants.
function SessionParticipantGrid({ participants }: { participants: Participant[] }) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  if (participants.length === 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
      {participants.map((p) => (
        <div key={p.id} style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}15`, textAlign: "center" }}>
          <Avatar style={{ width: 40, height: 40, margin: "0 auto 6px" }}>
            <AvatarFallback style={{ background: `${t.ACCENT}25`, color: t.ACCENT, fontSize: 14, fontWeight: 700 }}>{initials(p.name || p.id)}</AvatarFallback>
          </Avatar>
          <div style={{ fontSize: 11, color: t.SUBTLE }}>{p.name || p.id}</div>
        </div>
      ))}
    </div>
  );
}

export function PeerProgrammingSessionTab({ room, participants }: { room: Room | null; participants: Participant[] }) {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  const hasCohort = Boolean(room?.cohortId);
  const [credentials, setCredentials] = useState<PeerProgrammingSessionCredentials | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(): Promise<void> {
    setJoining(true);
    setError(null);
    try {
      setCredentials(await requestSessionCredentials(room?.cohortId ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the live session.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto", minHeight: 0 }}>
      <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${t.ACCENT}15 0%,rgba(139,92,246,0.05) 100%)`, border: `1px solid ${t.ACCENT}25` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Live Session</div>
        <div style={{ fontSize: 14, color: t.SUBTLE }}>{room?.name || "Your Cohort"} · {participants.length} participants</div>
      </div>

      {credentials ? (
        <PeerProgrammingSessionCall
          credentials={credentials}
          displayName={credentials.displayName}
          onLeave={() => setCredentials(null)}
        />
      ) : (
        <SessionJoinCard hasCohort={hasCohort} joining={joining} error={error} onJoin={() => void handleJoin()} />
      )}

      {!credentials && <SessionParticipantGrid participants={participants} />}
    </div>
  );
}
