"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MapPin, Share2 } from "lucide-react";
import { FAINT, SUBTLE, requestTags, settlementLabel, srHandle, timeAgo, type SrRequest, type SrRequestStatus } from "./sr-shared";
import { ShareLink } from "@/components/shared/share-link";
import { SrTargetsOnlyNotice } from "./sr-targets-only-notice";
import { useTheme } from '@/hooks/useTheme';
import { getSocketRelayTokens, type SocketRelayTokens } from './sr-shared';

const editButtonStyle = { padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer" } as const;

function CardAction({
  status,
  expired,
  isOwn,
  submitting,
  onClaim,
  onEdit,
  onRepost,
}: {
  status: SrRequestStatus;
  expired: boolean;
  isOwn: boolean;
  submitting: boolean;
  onClaim: () => void;
  onEdit: () => void;
  onRepost: () => void;
}) {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  const open = status === "open" && !expired;
  // An expired post is no longer in the active feed. The owner sees it under "Mine" with Re-post (which
  // resets the 28-day clock and re-opens it) and Edit; nobody else can claim it.
  if (expired) {
    if (isOwn) {
      return (
        <>
          <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 600 }}>Expired</div>
          <button onClick={onRepost} disabled={submitting} style={{ padding: "8px 14px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}>
            Re-post
          </button>
          <button onClick={onEdit} style={editButtonStyle}>Edit</button>
        </>
      );
    }
    return <div style={{ fontSize: 12, color: SUBTLE, fontWeight: 600 }}>Expired</div>;
  }
  // A claimed request has an active helper — the conversation lives on the Direct Line. It is neither
  // closed nor claimable, so it must not read "✓ closed" (that was the bug: a claimed request looked
  // closed in the feed while its Direct Line was still live).
  if (status === "claimed") return <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 600 }}>Being helped</div>;
  if (status === "canceled") return <div style={{ fontSize: 12, color: SUBTLE, fontWeight: 600 }}>Canceled</div>;
  if (!open) return <div style={{ fontSize: 12, color: "#22C55E", fontWeight: 600 }}>✓ closed</div>;
  if (isOwn) {
    return (
      <>
        <div style={{ fontSize: 12, color: SUBTLE }}>Your request</div>
        <button onClick={onEdit} style={editButtonStyle}>
          Edit
        </button>
      </>
    );
  }
  return (
    <button onClick={onClaim} disabled={submitting} style={{ padding: "8px 14px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}>
      I can help
    </button>
  );
}

// The badge row (tags, settlement, and status). Split from RequestCard so the several status-driven
// ternaries live in their own scope instead of inflating the card's complexity.
function CardBadges({
  request: r,
  t,
  open,
  expired,
}: {
  request: SrRequest;
  t: SocketRelayTokens;
  open: boolean;
  expired: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
      {requestTags(r).map((tag) => (
        <Badge key={tag} style={{ background: t.INPUT_BG, color: t.SUBTLE, border: "1px solid rgba(255,255,255,0.06)", fontSize: 11 }}>{tag}</Badge>
      ))}
      <Badge style={{ background: "rgba(34,197,94,0.10)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.25)", fontSize: 11 }}>{settlementLabel(r.priceCurrency, r.priceAmount)}</Badge>
      <Badge style={{ background: open ? "#22C55E20" : t.INPUT_BG, color: expired ? "#F59E0B" : open ? "#22C55E" : SUBTLE, border: `1px solid ${expired ? "#F59E0B40" : open ? "#22C55E40" : t.BORDER}`, fontSize: 11, textTransform: "capitalize" }}>{expired ? "expired" : r.status}</Badge>
    </div>
  );
}

// The meta row (handle, location, time, share). Split from RequestCard to keep the location guard out
// of the card's complexity budget.
function CardMeta({ request: r, t }: { request: SrRequest; t: SocketRelayTokens }) {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 12, color: SUBTLE, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ color: t.ACCENT, fontWeight: 600 }}>{srHandle(r.ownerUsername, r.id)}</span>
      {[r.city, r.state, r.country].some((v) => v && v.trim()) && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <MapPin size={11} /> {[r.city, r.state, r.country].map((v) => v?.trim()).filter(Boolean).join(", ")}
        </span>
      )}
      <span>· {timeAgo(r.createdAtIso)}</span>
      <ShareLink url={`/apps/socket-relay?request=${r.id}`} label="Share" title="Share this request" className="sr-share" />
    </div>
  );
}

function RequestCard({
  request,
  isOwn,
  submitting,
  onClaim,
  onEdit,
  onRepost,
}: {
  request: SrRequest;
  isOwn: boolean;
  submitting: boolean;
  onClaim: (id: string) => void;
  onEdit: (request: SrRequest) => void;
  onRepost: (id: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  const r = request;
  const expired = r.isExpired;
  // Expired posts dim and read as inactive, like a closed one.
  const open = r.status === "open" && !expired;
  return (
    <div style={{ padding: "18px 20px", borderRadius: 14, background: open ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)", border: `1px solid ${t.ACCENT}20`, opacity: open ? 1 : 0.6 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${t.ACCENT}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Share2 size={18} style={{ color: t.ACCENT }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CardBadges request={r} t={t} open={open} expired={expired} />
          {/* overflowWrap 'anywhere' on both: members paste URLs into requests, and a long URL has no
              space to break at, so the default wrapping rule lets it run past the card's right edge and
              get clipped (owner report — a GitHub link in a request was cut mid-address). `minWidth: 0`
              on the flex parent above lets the column shrink; this lets the text inside it break. */}
          <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, marginBottom: 4, lineHeight: 1.4, overflowWrap: "anywhere" }}>{r.title}</div>
          {r.details && <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 6, lineHeight: 1.5, overflowWrap: "anywhere" }}>{r.details}</div>}
          <CardMeta request={r} t={t} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
          <CardAction status={r.status} expired={expired} isOwn={isOwn} submitting={submitting} onClaim={() => onClaim(r.id)} onEdit={() => onEdit(r)} onRepost={() => onRepost(r.id)} />
        </div>
      </div>
    </div>
  );
}

// Shown when the feed has no cards: either the board is genuinely empty (with a Post Now shortcut) or a
// search/filter matched nothing. Split out so its copy ternaries stay off the feed's complexity budget.
function FeedEmptyState({
  filterActive,
  onPost,
  t,
}: {
  filterActive: boolean;
  onPost: () => void;
  t: SocketRelayTokens;
}) {
  return (
    <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px dashed ${t.ACCENT}4D`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Share2 size={20} style={{ color: `${t.ACCENT}66` }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: t.SUBTLE }}>{filterActive ? "No matches" : "No requests yet"}</div>
      <div style={{ fontSize: 13, color: FAINT }}>{filterActive ? "No requests match your search or filter. Try clearing it." : "Be the first to post a need or offer to your community."}</div>
      {!filterActive && (
        <button onClick={onPost} style={{ padding: "10px 20px", borderRadius: 10, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Post Now
        </button>
      )}
    </div>
  );
}

// The "Load more" button that pulls the next page of open requests. Split out so its disabled/label
// ternaries stay off the feed's complexity budget.
function LoadMoreButton({
  loadingMore,
  onLoadMore,
  t,
}: {
  loadingMore: boolean;
  onLoadMore: () => void;
  t: SocketRelayTokens;
}) {
  return (
    <button
      onClick={onLoadMore}
      disabled={loadingMore}
      style={{ marginTop: 4, padding: "10px 20px", borderRadius: 10, background: "transparent", border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: loadingMore ? "not-allowed" : "pointer", alignSelf: "center" }}
    >
      {loadingMore ? "Loading…" : "Load more"}
    </button>
  );
}

export function SocketRelayFeed({
  requests,
  currentUserId,
  submitting,
  filterActive = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onClaim,
  onPost,
  onEdit,
  onRepost,
}: {
  requests: SrRequest[];
  currentUserId: string | undefined;
  submitting: boolean;
  // True when a search term or a non-"All" category/"Mine" filter is active, so the empty state can say
  // "no matches" instead of falsely claiming the whole board is empty.
  filterActive?: boolean;
  // The board has more open requests than are loaded; show a "Load more" button that pulls the next page.
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onClaim: (id: string) => void;
  onPost: () => void;
  onEdit: (request: SrRequest) => void;
  onRepost: (id: string) => void;
}) {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "20px 24px" }}>
        <div style={{ marginBottom: 16 }}>
          <SrTargetsOnlyNotice />
        </div>
        {requests.length === 0 ? (
          <FeedEmptyState filterActive={filterActive} onPost={onPost} t={t} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {requests.map((r) => (
              <RequestCard key={r.id} request={r} isOwn={r.ownerUserId === currentUserId} submitting={submitting} onClaim={onClaim} onEdit={onEdit} onRepost={onRepost} />
            ))}
            {hasMore && onLoadMore && (
              <LoadMoreButton loadingMore={loadingMore} onLoadMore={onLoadMore} t={t} />
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
