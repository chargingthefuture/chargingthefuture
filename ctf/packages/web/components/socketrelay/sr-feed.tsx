"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MapPin, Share2 } from "lucide-react";
import { COLOR, FAINT, SUBTLE, requestTags, settlementLabel, srHandle, timeAgo, type SrRequest } from "./sr-shared";
import { ShareLink } from "@/components/shared/share-link";

function CardAction({ open, isOwn, submitting, onClaim, onEdit }: { open: boolean; isOwn: boolean; submitting: boolean; onClaim: () => void; onEdit: () => void }) {
  if (!open) return <div style={{ fontSize: 12, color: "#22C55E", fontWeight: 600 }}>✓ closed</div>;
  if (isOwn) {
    return (
      <>
        <div style={{ fontSize: 12, color: SUBTLE }}>Your request</div>
        <button onClick={onEdit} style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          Edit
        </button>
      </>
    );
  }
  return (
    <button onClick={onClaim} disabled={submitting} style={{ padding: "8px 14px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}>
      I can help
    </button>
  );
}

function RequestCard({
  request,
  isOwn,
  submitting,
  onClaim,
  onEdit,
}: {
  request: SrRequest;
  isOwn: boolean;
  submitting: boolean;
  onClaim: (id: string) => void;
  onEdit: (request: SrRequest) => void;
}) {
  const r = request;
  const open = r.status === "open";
  return (
    <div style={{ padding: "18px 20px", borderRadius: 14, background: open ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)", border: `1px solid ${COLOR}20`, opacity: open ? 1 : 0.6 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${COLOR}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Share2 size={18} style={{ color: COLOR }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
            {requestTags(r).map((tag) => (
              <Badge key={tag} style={{ background: "rgba(255,255,255,0.04)", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.06)", fontSize: 11 }}>{tag}</Badge>
            ))}
            <Badge style={{ background: "rgba(34,197,94,0.10)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.25)", fontSize: 11 }}>{settlementLabel(r.priceCurrency, r.priceAmount)}</Badge>
            <Badge style={{ background: open ? "#22C55E20" : "rgba(255,255,255,0.04)", color: open ? "#22C55E" : SUBTLE, border: `1px solid ${open ? "#22C55E40" : "rgba(255,255,255,0.06)"}`, fontSize: 11, textTransform: "capitalize" }}>{r.status}</Badge>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#F9FAFB", marginBottom: 4, lineHeight: 1.4 }}>{r.title}</div>
          {r.details && <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 6, lineHeight: 1.5 }}>{r.details}</div>}
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: SUBTLE, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: COLOR, fontWeight: 600 }}>{srHandle(r.ownerUsername, r.id)}</span>
            {r.city && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {r.city}</span>}
            <span>· {timeAgo(r.createdAtIso)}</span>
            <ShareLink url={`/apps/socketrelay?request=${r.id}`} label="Share" title="Share this request" className="sr-share" />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
          <CardAction open={open} isOwn={isOwn} submitting={submitting} onClaim={() => onClaim(r.id)} onEdit={() => onEdit(r)} />
        </div>
      </div>
    </div>
  );
}

export function SocketRelayFeed({
  requests,
  currentUserId,
  submitting,
  onClaim,
  onPost,
  onEdit,
}: {
  requests: SrRequest[];
  currentUserId: string | undefined;
  submitting: boolean;
  onClaim: (id: string) => void;
  onPost: () => void;
  onEdit: (request: SrRequest) => void;
}) {
  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "20px 24px" }}>
        {requests.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px dashed ${COLOR}4D`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Share2 size={20} style={{ color: `${COLOR}66` }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No requests yet</div>
            <div style={{ fontSize: 13, color: FAINT }}>Be the first to post a need or offer to your community.</div>
            <button onClick={onPost} style={{ padding: "10px 20px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Post Now
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {requests.map((r) => (
              <RequestCard key={r.id} request={r} isOwn={r.ownerUserId === currentUserId} submitting={submitting} onClaim={onClaim} onEdit={onEdit} />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
