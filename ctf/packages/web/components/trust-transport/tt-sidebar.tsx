"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/hooks/useTheme";
import { getTrustTransportTokens, type RideType, type TripRequest } from "./tt-shared";

export function TrustTransportSidebar({
  rideTypes,
  rideType,
  onRideType,
  requests,
}: {
  rideTypes: RideType[];
  rideType: string;
  onRideType: (id: string) => void;
  requests: TripRequest[];
}) {
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);
  return (
    <aside style={{ width: 240, background: t.HEADER, borderRight: `1px solid ${t.BORDER}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 12 }}>TrustTransport</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {rideTypes.map((rt) => {
            const Icon = rt.icon;
            const active = rideType === rt.id;
            return (
              <button key={rt.id} type="button" onClick={() => onRideType(rt.id)} style={{ flex: 1, padding: "8px 6px", borderRadius: 10, background: active ? `${rt.color}20` : t.INPUT_BG, border: `1px solid ${active ? rt.color + "50" : t.BORDER}`, cursor: "pointer", textAlign: "center" }}>
                <Icon size={16} style={{ color: active ? rt.color : t.MUTED, margin: "0 auto 2px" }} />
                <div style={{ fontSize: 10, color: active ? rt.color : t.MUTED, fontWeight: 600 }}>{rt.name}</div>
              </button>
            );
          })}
        </div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "12px 8px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", marginBottom: 8, padding: "0 10px" }}>My Trips</div>
          {requests.length === 0 ? (
            <div style={{ padding: "10px", fontSize: 12, color: t.FAINT, textAlign: "center" }}>No trips yet</div>
          ) : (
            requests.slice(0, 3).map((r) => (
              <div key={r.id} style={{ padding: "10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: t.TEXT, fontWeight: 600, marginBottom: 2 }}>
                  {/* The API returns pickupCity/dropoffCity (and a title), never fromLocation/toLocation,
                      so read those first — matching the tracking and chat tabs — to avoid always showing "— → —". */}
                  {r.pickupCity ?? r.fromLocation ?? "—"} → {r.dropoffCity ?? r.toLocation ?? "—"}
                </div>
                <div style={{ fontSize: 11, color: t.FAINT }}>{r.status ?? "Pending"}</div>
              </div>
            ))
          )}
          <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.FAINT, textTransform: "uppercase", padding: "0 10px" }}>Quick Stats</div>
          <div style={{ padding: "6px 10px", fontSize: 12, color: t.MUTED }}>
            My Requests: <span style={{ color: t.ACCENT, fontWeight: 600 }}>{requests.length}</span>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
