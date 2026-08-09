"use client";

import { useEffect, useRef, useState } from "react";
import { Car } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { AppLoading } from "@/components/shared/app-loading";
import { useTheme } from "@/hooks/useTheme";
import { BG, deriveRideTypes, getTrustTransportTokens, type ChatCreds, type Mode, type Tab, type TripRequest } from "./tt-shared";
import { TrustTransportBookTab } from "./tt-book-tab";
import { TrustTransportTrackingTab } from "./tt-tracking-tab";
import { TrustTransportHelpTab } from "./tt-help-tab";
import { TrustTransportEarningsTab } from "./tt-earnings-tab";
import { TrustTransportChatTab } from "./tt-chat-tab";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";

// Build the create-request body from the booking form. The API expects mode + title + details (both
// required) and optional pickup/dropoff cities — not fromLocation/toLocation. Settlement: the chosen
// value type (default Free) with an amount only for priced types, plus the accepted-currencies set
// (split settlements — every currency the requester accepts, independent of the single price).
function buildBookingBody(args: {
  rideType: string;
  pickup: string;
  dropoff: string;
  priceCurrency: string;
  priceAmount: string;
  acceptedCurrencies: string[];
}) {
  const modeLabel = args.rideType.charAt(0).toUpperCase() + args.rideType.slice(1);
  const parsedAmount = Number(args.priceAmount);
  return {
    mode: args.rideType,
    title: `${modeLabel}: ${args.pickup} → ${args.dropoff}`.slice(0, 160),
    details: `Pickup: ${args.pickup}\nDrop-off: ${args.dropoff}`,
    pickupCity: args.pickup,
    dropoffCity: args.dropoff,
    priceCurrency: args.priceCurrency || null,
    priceAmount: Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : null,
    acceptedCurrencies: args.acceptedCurrencies,
  };
}

export function TrustTransportShell({ isAdmin }: { isAdmin?: boolean } = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modes, setModes] = useState<Mode[]>([]);
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("book");
  const [rideType, setRideType] = useState("ride");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // How the requester will settle the ride (issue #420): default Free (a free ride is valid mutual aid);
  // amount only for priced types.
  const [priceCurrency, setPriceCurrency] = useState("FREE");
  const [priceAmount, setPriceAmount] = useState("");
  const [requiresAmount, setRequiresAmount] = useState(false);
  // Split settlements: every currency the requester accepts, independent of the single settlement
  // above (a ride settled part in ServiceCredits and part in dollars checks both).
  const [acceptedCurrencies, setAcceptedCurrencies] = useState<string[]>([]);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TripRequest | null>(null);
  const [chatCredentials, setChatCredentials] = useState<ChatCreds | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  // Tracks the most recently requested chat trip so a slower earlier response
  // can't overwrite the credentials for a trip the user has since switched to.
  const activeChatReqRef = useRef<string | null>(null);
  const { theme } = useTheme();
  const t = getTrustTransportTokens(theme);

  async function fetchRequests() {
    const res = await fetch("/api/trust-transport/requests");
    if (res.ok) {
      // The API wraps the list as { ok, items, page, ... } — the array is .items,
      // not the top-level body. Reading the body directly made `requests` an
      // object, so requests.map(...) in the tracking/chat tabs threw.
      const data = (await res.json()) as { items?: TripRequest[] };
      setRequests(Array.isArray(data.items) ? data.items : []);
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [modesRes] = await Promise.all([fetch("/api/trust-transport/modes"), fetchRequests()]);
        if (modesRes.ok) {
          // The API returns { ok, modes: string[] } (e.g. ["ride","package","food"]).
          // Reading the body directly made `modes` the wrapper object, so
          // deriveRideTypes(modes) called .map on an object and crashed the page.
          // Pull out .modes and turn the strings into Mode objects.
          const data = (await modesRes.json()) as { modes?: unknown };
          const rawModes: unknown[] = Array.isArray(data.modes) ? data.modes : [];
          setModes(rawModes.map((m) => (typeof m === "string" ? { id: m, name: m } : (m as Mode))));
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load TrustTransport.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, []);

  async function handleBook() {
    if (!from.trim() || !to.trim()) { setBookingError("Please enter pickup and destination."); return; }
    // A priced value type (ServiceCredits, fiat, crypto) needs a positive amount; Free/Barter don't.
    const parsedAmount = Number(priceAmount);
    if (requiresAmount && !(Number.isFinite(parsedAmount) && parsedAmount > 0)) {
      setBookingError("Enter an amount greater than zero for this value type.");
      return;
    }
    setSubmitting(true);
    setBookingError(null);
    try {
      // Body building lives in buildBookingBody; send the x-ctf-csrf header every mutation requires
      // (without it the request is denied 403).
      const res = await fetch("/api/trust-transport/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify(buildBookingBody({ rideType, pickup: from.trim(), dropoff: to.trim(), priceCurrency, priceAmount, acceptedCurrencies })),
      });
      if (!res.ok) throw new Error("Failed to create request");
      setBooked(true);
      await fetchRequests();
    } catch (e: unknown) {
      setBookingError(e instanceof Error ? e.message : "Failed to book.");
    } finally {
      setSubmitting(false);
    }
  }

  async function fetchChatForRequest(req: TripRequest) {
    activeChatReqRef.current = req.id;
    setSelectedRequest(req);
    setChatCredentials(null);
    setChatError(null);
    // Chat is keyed by trip id, which only exists once an offer is accepted. The request id is not a
    // trip id, so calling the chat route with it would always 404. Guard until a trip exists.
    if (!req.tripId) {
      setChatLoading(false);
      setChatError("Chat opens once a driver accepts this request.");
      return;
    }
    setChatLoading(true);
    try {
      const res = await fetch(`/api/trust-transport/trips/${req.tripId}/chat`, { method: "POST", headers: { "x-ctf-csrf": "1" } });
      if (!res.ok) throw new Error("Failed to fetch chat credentials");
      const data = (await res.json()) as ChatCreds;
      if (!data.ok) throw new Error(data.message ?? "No chat credentials");
      if (activeChatReqRef.current !== req.id) return;
      setChatCredentials(data);
    } catch (e: unknown) {
      if (activeChatReqRef.current !== req.id) return;
      setChatError(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      if (activeChatReqRef.current === req.id) setChatLoading(false);
    }
  }

  function openChat(req: TripRequest) {
    setTab("chat");
    void fetchChatForRequest(req);
  }

  if (loading) return <AppLoading />;
  if (error) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  const rideTypes = deriveRideTypes(modes);

  const content = (
    <>
      {tab === "book" && (
        <TrustTransportBookTab
          rideTypes={rideTypes}
          rideType={rideType}
          onRideType={setRideType}
          from={from}
          to={to}
          onFrom={setFrom}
          onTo={setTo}
          priceCurrency={priceCurrency}
          priceAmount={priceAmount}
          requiresAmount={requiresAmount}
          onPriceCurrency={(code, currency) => {
            const needs = currency?.requiresAmount ?? false;
            setPriceCurrency(code);
            setRequiresAmount(needs);
            if (!needs) setPriceAmount("");
          }}
          onPriceAmount={setPriceAmount}
          acceptedCurrencies={acceptedCurrencies}
          onToggleAcceptedCurrency={(code) =>
            setAcceptedCurrencies((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
          }
          bookingError={bookingError}
          booked={booked}
          submitting={submitting}
          onBook={() => void handleBook()}
          onReset={() => { setBooked(false); setFrom(""); setTo(""); setPriceCurrency("FREE"); setPriceAmount(""); setRequiresAmount(false); setAcceptedCurrencies([]); }}
        />
      )}
      {tab === "tracking" && (
        <TrustTransportTrackingTab requests={requests} onBook={() => setTab("book")} onChat={openChat} onAccepted={() => void fetchRequests()} onCancelled={() => void fetchRequests()} onCompletionConfirmed={() => void fetchRequests()} />
      )}
      {tab === "help" && <TrustTransportHelpTab />}
      {tab === "earnings" && <TrustTransportEarningsTab />}
      {tab === "chat" && (
        <TrustTransportChatTab
          requests={requests}
          selectedRequest={selectedRequest}
          chatCredentials={chatCredentials}
          chatLoading={chatLoading}
          chatError={chatError}
          onSelect={(r) => void fetchChatForRequest(r)}
          onBook={() => setTab("book")}
        />
      )}
    </>
  );

    const tabs: { key: Tab; label: string }[] = [
      { key: "book", label: "Book" },
      { key: "tracking", label: "Tracking" },
      { key: "help", label: "Help" },
      { key: "earnings", label: "Earnings" },
      { key: "chat", label: "Direct Line" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
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
            <RefreshButton onRefresh={() => fetchRequests()} title="Refresh" />
            <MobileTopActions />
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? t.ACCENT_TINT_BG : "transparent", border: `1px solid ${tab === key ? t.ACCENT_TAB_BORDER : t.BORDER_STRONG}`, color: tab === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        </div>
        {content}
      </div>
    );
}
