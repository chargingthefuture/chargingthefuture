"use client";

import { useEffect, useRef, useState } from "react";
import { AppLoading } from "@/components/shared/app-loading";
import { useTheme } from "@/hooks/useTheme";
import { failureText, responseFailureText } from "@/lib/errors/client-failure";
import { reportError } from "@/lib/observability/report";
import { BG, deriveRideTypes, getTrustTransportTokens, type ChatCreds, type Mode, type Tab, type TripRequest } from "./tt-shared";
import { TrustTransportBookTab } from "./tt-book-tab";
import { TrustTransportHelpTab } from "./tt-help-tab";
import { TrustTransportEarningsTab } from "./tt-earnings-tab";
import { TrustTransportHeader, TrustTransportTripTabs } from "./tt-shell-parts";

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
  const [requestsError, setRequestsError] = useState<string | null>(null);
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
    // A failed load keeps whatever list was already shown and says why, so Tracking and Direct Line
    // never read "No active trips" to a member whose trips simply did not load (rule 137).
    try {
      const res = await fetch("/api/trust-transport/requests");
      if (!res.ok) {
        setRequestsError(await responseFailureText(res, "Could not load your trips.", "member"));
        return;
      }
      // The API wraps the list as { ok, items, page, ... } — the array is .items,
      // not the top-level body. Reading the body directly made `requests` an
      // object, so requests.map(...) in the tracking/chat tabs threw.
      const data = (await res.json()) as { items?: TripRequest[] };
      setRequests(Array.isArray(data.items) ? data.items : []);
      setRequestsError(null);
    } catch (e: unknown) {
      setRequestsError(failureText(e, { area: "trust-transport", op: "fetch_requests", fallback: "Could not load your trips.", audience: "member" }));
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
        } else {
          // Booking still works from the built-in ride types, so this is not shown; report it so the
          // failed load is not lost.
          reportError(new Error(await responseFailureText(modesRes, "Could not load TrustTransport modes.")), { area: "trust-transport", op: "fetch_modes" });
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
      if (!res.ok) throw new Error(await responseFailureText(res, "Failed to create request", "member"));
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
      if (!res.ok) throw new Error(await responseFailureText(res, "Failed to fetch chat credentials", "member"));
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
      {tab === "help" && <TrustTransportHelpTab />}
      {tab === "earnings" && <TrustTransportEarningsTab />}
      <TrustTransportTripTabs
        tab={tab}
        requests={requests}
        requestsError={requestsError}
        selectedRequest={selectedRequest}
        chatCredentials={chatCredentials}
        chatLoading={chatLoading}
        chatError={chatError}
        onBook={() => setTab("book")}
        onChat={openChat}
        onSelectChat={(r) => void fetchChatForRequest(r)}
        onTripsChanged={() => void fetchRequests()}
      />
    </>
  );

    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <TrustTransportHeader t={t} isAdmin={isAdmin} tab={tab} onTab={setTab} onRefresh={() => fetchRequests()} />
        {content}
      </div>
    );
}
