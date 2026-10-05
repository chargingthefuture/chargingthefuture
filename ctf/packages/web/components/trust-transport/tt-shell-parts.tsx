"use client";

import { Car } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";
import { getTrustTransportTokens, type ChatCreds, type Tab, type TripRequest } from "./tt-shared";
import { TrustTransportTrackingTab } from "./tt-tracking-tab";
import { TrustTransportChatTab } from "./tt-chat-tab";

type TtTokens = ReturnType<typeof getTrustTransportTokens>;

const TABS: { key: Tab; label: string }[] = [
  { key: "book", label: "Book" },
  { key: "tracking", label: "Tracking" },
  { key: "help", label: "Help" },
  { key: "earnings", label: "Earnings" },
  { key: "chat", label: "Direct Line" },
];

export function TrustTransportHeader({
  t,
  isAdmin,
  tab,
  onTab,
  onRefresh,
}: {
  t: TtTokens;
  isAdmin?: boolean;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
      {/* flexWrap: this row carries the plugin actions plus the three global ones, which
          together overflow a 390px phone — the last control was clipped off the right
          edge and the title collapsed to nothing. Wrapping reflows instead of cutting
          off; on a wider viewport it still renders as one line. */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 6, gap: 10, padding: "10px 14px" }}>
        <BackChevronButton accent={t.ACCENT} />
        <Car size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>TrustTransport</span>
        <PluginAdminButton href="/admin/trust-transport" isAdmin={isAdmin} accent={t.ACCENT} />
        <RefreshButton onRefresh={onRefresh} title="Refresh" />
        <MobileTopActions />
      </div>
      <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => onTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? t.ACCENT_TINT_BG : "transparent", border: `1px solid ${tab === key ? t.ACCENT_TAB_BORDER : t.BORDER_STRONG}`, color: tab === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

// Tracking and Direct Line both read the member's trips. A failed load says why above either tab,
// and the tab itself stays hidden while there is nothing loaded to show, so neither reads "No active
// trips" to a member whose trips did not load (rule 137).
export function TrustTransportTripTabs({
  tab,
  requests,
  requestsError,
  selectedRequest,
  chatCredentials,
  chatLoading,
  chatError,
  onBook,
  onChat,
  onSelectChat,
  onTripsChanged,
}: {
  tab: Tab;
  requests: TripRequest[];
  requestsError: string | null;
  selectedRequest: TripRequest | null;
  chatCredentials: ChatCreds | null;
  chatLoading: boolean;
  chatError: string | null;
  onBook: () => void;
  onChat: (req: TripRequest) => void;
  onSelectChat: (req: TripRequest) => void;
  onTripsChanged: () => void;
}) {
  const showsTrips = tab === "tracking" || tab === "chat";
  const nothingLoaded = Boolean(requestsError) && requests.length === 0;
  return (
    <>
      {requestsError && showsTrips && (
        <div role="alert" style={{ margin: "12px 14px 0", fontSize: 13, color: "#EF4444" }}>{requestsError}</div>
      )}
      {tab === "tracking" && !nothingLoaded && (
        <TrustTransportTrackingTab requests={requests} onBook={onBook} onChat={onChat} onAccepted={onTripsChanged} onCancelled={onTripsChanged} onCompletionConfirmed={onTripsChanged} />
      )}
      {tab === "chat" && !nothingLoaded && (
        <TrustTransportChatTab
          requests={requests}
          selectedRequest={selectedRequest}
          chatCredentials={chatCredentials}
          chatLoading={chatLoading}
          chatError={chatError}
          onSelect={onSelectChat}
          onBook={onBook}
        />
      )}
    </>
  );
}
