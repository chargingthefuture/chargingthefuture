"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hammer, Search } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { AppLoading } from "@/components/shared/app-loading";
import { useTheme } from "@/hooks/useTheme";
import { FONT, getFoundationTokens, type FoundationTab, type ProviderView, type QuoteView } from "./foundation-ui";
import { BrowsePanel, QuotesPanel } from "./foundation-panels";
import { OfferSkillsPanel } from "./foundation-offer-skills";
import { ProviderProfile } from "./foundation-profile";
import { DirectLineFromQuote, DirectLineFromThread, type DirectLineCredentials } from "./foundation-direct-line";
import { FoundationInstantCallController } from "./foundation-instant-call";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";

const CSRF_HEADERS = { "Content-Type": "application/json", "x-ctf-csrf": "1" };

type FoundationTokens = ReturnType<typeof getFoundationTokens>;

// The thread POST returns the connection id plus the Stream credentials needed to land the member in
// the Direct Line straight away.
type FoundationThreadResponse = {
  thread?: { id?: string; streamChannelId?: string };
  streamApiKey?: string;
  streamUserId?: string;
  streamToken?: string;
};

// Member-facing text for each Foundation API failure `code`. The most common case is requesting a
// quote from your own profile, which the server denies as a policy.
const FOUNDATION_ERROR_MESSAGES: Record<string, string> = {
  FOUNDATION_POLICY_DENIED: "You can't request a quote from your own profile.",
  FOUNDATION_PROVIDER_NOT_FOUND: "This provider's profile could not be found.",
  FOUNDATION_RATE_LIMIT_EXCEEDED: "You're sending requests too quickly — wait a moment and try again.",
  FOUNDATION_STREAM_UNAVAILABLE: "Connections are temporarily unavailable. Please try again shortly.",
  FOUNDATION_PERSISTENCE_UNAVAILABLE: "Connections are temporarily unavailable. Please try again shortly.",
  FOUNDATION_CSRF_DENIED: "Your session needs a refresh — reload the page and try again.",
};

// Read a failed response's JSON `code`/`message`, tolerating a non-JSON body.
async function readFoundationErrorBody(res: Response): Promise<{ code: string; message: string }> {
  try {
    const body = (await res.json()) as { code?: string; message?: string };
    return { code: body.code ?? "", message: body.message ?? "" };
  } catch {
    /* non-JSON body — fall back below */
    return { code: "", message: "" };
  }
}

// Turn a failed Foundation API response into a clear member-facing message by reading the route's
// JSON `code`, instead of always showing a generic "could not open a connection".
async function foundationErrorMessage(res: Response, fallback: string): Promise<string> {
  const { code, message } = await readFoundationErrorBody(res);
  return FOUNDATION_ERROR_MESSAGES[code] || message || fallback;
}

function toErrorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

// Trade filter has no client-side field to match on; it scopes the server search query.
function buildFoundationSearchParams(searchTerm: string, skillId: string | null): string {
  const params = new URLSearchParams();
  if (searchTerm) params.set("q", searchTerm);
  if (skillId) params.set("skillId", skillId);
  return params.toString();
}

async function fetchFoundationProviders(
  queryString: string,
): Promise<{ items: ProviderView[]; viewerUserId: string | null } | null> {
  const res = await fetch(`/api/foundation/providers/search?${queryString}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: ProviderView[]; viewerUserId?: string };
  return { items: data.items ?? [], viewerUserId: data.viewerUserId ?? null };
}

function resolveServiceType(headline: ProviderView["headline"]): string {
  return headline?.trim() || "General trade service";
}

// Take the member straight into the Direct Line using the credentials the thread POST already
// returned. Returns null when Stream credentials were not issued (e.g. Stream is unconfigured), so
// the caller can fall back to the Quotes tab instead of losing the request.
function buildDirectLineCredentials(threadData: FoundationThreadResponse): DirectLineCredentials | null {
  const channelId = threadData.thread?.streamChannelId;
  if (threadData.streamApiKey && threadData.streamUserId && threadData.streamToken && channelId) {
    return {
      streamApiKey: threadData.streamApiKey,
      streamUserId: threadData.streamUserId,
      streamToken: threadData.streamToken,
      streamChannelId: channelId,
    };
  }
  return null;
}

function Centered({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, color }}>
      {children}
    </div>
  );
}

type FoundationMainScreenProps = {
  t: FoundationTokens;
  isAdmin?: boolean;
  tab: FoundationTab;
  onTabChange: (tab: FoundationTab) => void;
  query: string;
  onQueryChange: (query: string) => void;
  providers: ProviderView[];
  viewerUserId: string | null;
  onSelectProvider: (provider: ProviderView) => void;
  skillId: string | null;
  skillName: string | null;
  onSkillFilter: (skillId: string | null, skillName?: string | null) => void;
  searchTerm: string;
  quotes: QuoteView[];
  onOpenDirectLine: (quote: QuoteView) => void;
  onRespond: (quote: QuoteView, quotedAmount: number, quotedCurrency: string) => Promise<boolean>;
  onRefresh: () => void;
};

const FOUNDATION_TABS: { key: FoundationTab; label: string }[] = [
  { key: "browse", label: "Browse" },
  { key: "offer", label: "Offer" },
  { key: "quotes", label: "Quotes" },
];

// The browse/offer/quotes screen: sticky header, tab bar, search, and the active tab's panel.
function FoundationMainScreen(props: FoundationMainScreenProps) {
  const { t, tab } = props;
  return (
    <div style={{ minHeight: "100vh", background: t.BG, fontFamily: FONT, color: t.TEXT }}>
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
        {/* flexWrap: this row carries the plugin actions plus the three global ones, which
              together overflow a 390px phone — the last control was clipped off the right
              edge and the title collapsed to nothing. Wrapping reflows instead of cutting
              off; on a wider viewport it still renders as one line. */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 6, gap: 8, padding: "10px 14px" }}>
          <BackChevronButton accent={t.ACCENT} />
          <Hammer size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
          {/* Title shrinks and truncates so the trailing controls stay on screen */}
          <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Foundation</span>
          <PluginAdminButton href="/admin/foundation" isAdmin={props.isAdmin} accent={t.ACCENT} />
          <RefreshButton onRefresh={props.onRefresh} title="Refresh" />
          <MobileTopActions />
        </div>
        <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
          {FOUNDATION_TABS.map(({ key, label }) => {
            const isActive = tab === key;
            return (
              <button key={key} onClick={() => props.onTabChange(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: isActive ? `${t.ACCENT}1A` : "transparent", border: `1px solid ${isActive ? t.ACCENT + "40" : t.BORDER_STRONG}`, color: isActive ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            );
          })}
        </div>
        {tab === "browse" && (
          <div style={{ padding: "0 12px 10px" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.FAINT }} />
              <input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)} placeholder="Search trade providers…" style={{ width: "100%", padding: "8px 10px 8px 30px", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, fontSize: 13, color: t.SUBTLE, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
        )}
      </div>
      <FoundationTabContent {...props} />
    </div>
  );
}

// The active tab's panel, split out so the main screen stays under the complexity limit.
function FoundationTabContent(props: FoundationMainScreenProps) {
  const { tab } = props;
  return (
    <>
      {tab === "browse" && <BrowsePanel providers={props.providers} viewerUserId={props.viewerUserId} onSelect={props.onSelectProvider} activeSkillId={props.skillId} activeSkillName={props.skillName} searchActive={props.searchTerm.length > 0} onSkillFilter={props.onSkillFilter} />}
      {tab === "offer" && <OfferSkillsPanel />}
      {tab === "quotes" && (
        <QuotesPanel
          quotes={props.quotes}
          viewerUserId={props.viewerUserId}
          onBrowse={() => props.onTabChange("browse")}
          onOpenDirectLine={props.onOpenDirectLine}
          onRespond={props.onRespond}
        />
      )}
    </>
  );
}

export function FoundationShell({ isAdmin, initialProviderId }: { isAdmin?: boolean; initialProviderId?: string } = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderView[]>([]);
  // The signed-in member's own id, returned by the search route, so the "Connect now" button is never
  // shown on the viewer's own provider card (you can't ring yourself).
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuoteView[]>([]);
  const [tab, setTab] = useState<FoundationTab>("browse");
  const [trade] = useState("All Trades");
  const [query, setQuery] = useState("");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [skillName, setSkillName] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProviderView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteSuccess, setQuoteSuccess] = useState(false);
  // The Direct Line opened straight after Request Quote, holding the Stream credentials the thread
  // POST returned, plus the provider name to show in the heading.
  const [activeDirectLine, setActiveDirectLine] = useState<{ credentials: DirectLineCredentials; subtitle: string | null } | null>(null);
  // The Direct Line re-opened from a Quotes row — only the thread id; credentials are fetched fresh.
  const [quoteDirectLine, setQuoteDirectLine] = useState<{ threadId: string; subtitle: string | null } | null>(null);
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  // Bumped by the header refresh button; the load effect re-runs without the full-screen loading
  // state (search/filter changes still show it, as before).
  const [refreshKey, setRefreshKey] = useState(0);
  const lastRefreshKey = useRef(0);

  // Trade filter has no client-side field to match on; it scopes the server search query.
  const searchTerm = [trade === "All Trades" ? "" : trade, query].filter(Boolean).join(" ").trim();

  const loadQuotes = useCallback(async () => {
    const res = await fetch("/api/foundation/quotes/history");
    if (res.ok) {
      const data = (await res.json()) as { items?: QuoteView[] };
      setQuotes(data.items ?? []);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const isRefresh = refreshKey !== lastRefreshKey.current;
    lastRefreshKey.current = refreshKey;
    async function load() {
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const [search] = await Promise.all([
          fetchFoundationProviders(buildFoundationSearchParams(searchTerm, skillId)),
          loadQuotes(),
        ]);
        if (!active) return;
        if (search) {
          setProviders(search.items);
          setViewerUserId(search.viewerUserId);
        }
      } catch (e: unknown) {
        if (active) setError(toErrorMessage(e, "Failed to load Foundation."));
      } finally {
        if (active && !isRefresh) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [searchTerm, skillId, loadQuotes, refreshKey]);

  // Deep-link open: when the page was reached via /apps/foundation/provider/[id] (a shared link),
  // fetch that one provider and open its profile. The id may not be on the current search page, so
  // this fetches it directly rather than matching the loaded list. Unauthenticated visitors never
  // get here — the route redirects them to the Foundation landing.
  useEffect(() => {
    if (!initialProviderId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/foundation/providers/${encodeURIComponent(initialProviderId)}`, { signal: controller.signal });
        if (!res.ok || controller.signal.aborted) return;
        const data = (await res.json()) as { provider?: ProviderView; viewerUserId?: string };
        if (controller.signal.aborted) return;
        if (data.viewerUserId) setViewerUserId(data.viewerUserId);
        if (data.provider) setSelected(data.provider);
      } catch {
        // Aborted or unavailable: the browse view stays open instead of the deep-linked profile.
      }
    })();
    return () => controller.abort();
  }, [initialProviderId]);

  // Real quote creation is two steps: open a connection thread, then request a quote on it.
  const requestQuote = useCallback(async (provider: ProviderView) => {
    setSubmitting(true);
    setQuoteError(null);
    setQuoteSuccess(false);
    try {
      const threadRes = await fetch("/api/foundation/connections/threads", {
        method: "POST",
        headers: CSRF_HEADERS,
        body: JSON.stringify({ providerId: provider.profileId }),
      });
      if (!threadRes.ok) throw new Error(await foundationErrorMessage(threadRes, "Could not open a connection with this provider."));
      const threadData = (await threadRes.json()) as FoundationThreadResponse;
      const threadId = threadData.thread?.id;
      if (!threadId) throw new Error("Connection response was incomplete.");

      const serviceType = resolveServiceType(provider.headline);
      const quoteRes = await fetch("/api/foundation/quotes", {
        method: "POST",
        headers: CSRF_HEADERS,
        body: JSON.stringify({ threadId, serviceType }),
      });
      if (!quoteRes.ok) throw new Error(await foundationErrorMessage(quoteRes, "Could not submit the quote request."));

      setQuoteSuccess(true);
      // Refresh quotes in the background; do not block landing in the Direct Line on it.
      void loadQuotes();
      setSelected(null);

      // Land in the Direct Line when Stream credentials were issued; otherwise fall back to the
      // Quotes tab so the request is never lost.
      const credentials = buildDirectLineCredentials(threadData);
      if (credentials) {
        setActiveDirectLine({ credentials, subtitle: provider.displayName });
      } else {
        setTab("quotes");
      }
    } catch (e: unknown) {
      setQuoteError(toErrorMessage(e, "Failed to request quote."));
    } finally {
      setSubmitting(false);
    }
  }, [loadQuotes]);

  // Provider responds to a requested quote with a price: POST the state transition to
  // 'provider_responded' carrying quotedAmount + quotedCurrency. Only the provider can do this (the
  // server enforces provider-only). On success, refresh the quotes list so the row shows the price.
  const respondToQuote = useCallback(async (quote: QuoteView, quotedAmount: number, quotedCurrency: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/foundation/quotes/${encodeURIComponent(quote.id)}/state`, {
        method: "POST",
        headers: CSRF_HEADERS,
        body: JSON.stringify({ transitionTo: "provider_responded", quotedAmount, quotedCurrency }),
      });
      if (!res.ok) return false;
      await loadQuotes();
      return true;
    } catch {
      return false;
    }
  }, [loadQuotes]);

  if (loading) {
    return <AppLoading />;
  }

  if (error) {
    return <Centered color="#EF4444">{error}</Centered>;
  }

  // The instant-call controller (issue #808 task 3) wraps every interactive Foundation surface so that:
  // the "Connect now" button can place a ring from anywhere it appears, AND a member being rung sees the
  // in-app incoming-call surface regardless of which tab/screen they are on. displayName is cosmetic on
  // the client (the server mints the Stream token from the real signed-in identity); fall back to a stable
  // label when the viewer id is not yet known.
  const withInstantCall = (node: React.ReactNode) => (
    <FoundationInstantCallController displayName={viewerUserId ?? "Member"}>
      {node}
    </FoundationInstantCallController>
  );

  // Direct Line opened straight after Request Quote (uses the credentials the POST returned).
  if (activeDirectLine) {
    return withInstantCall(
      <DirectLineFromQuote
        credentials={activeDirectLine.credentials}
        subtitle={activeDirectLine.subtitle}
        onBack={() => { setActiveDirectLine(null); setTab("quotes"); }}
      />,
    );
  }

  // Direct Line re-opened from a Quotes row (fetches fresh credentials by thread id).
  if (quoteDirectLine) {
    return withInstantCall(
      <DirectLineFromThread
        threadId={quoteDirectLine.threadId}
        subtitle={quoteDirectLine.subtitle}
        onBack={() => setQuoteDirectLine(null)}
      />,
    );
  }

  if (selected) {
    return withInstantCall(
      <ProviderProfile
        provider={selected}
        viewerUserId={viewerUserId}
        submitting={submitting}
        quoteError={quoteError}
        quoteSuccess={quoteSuccess}
        onBack={() => { setSelected(null); setQuoteError(null); setQuoteSuccess(false); }}
        onRequestQuote={() => { void requestQuote(selected); }}
      />,
    );
  }

  return withInstantCall(
    <FoundationMainScreen
      t={t}
      isAdmin={isAdmin}
      tab={tab}
      onTabChange={setTab}
      query={query}
      onQueryChange={setQuery}
      providers={providers}
      viewerUserId={viewerUserId}
      onSelectProvider={setSelected}
      skillId={skillId}
      skillName={skillName}
      onSkillFilter={(id, name) => { setSkillId(id); setSkillName(name ?? null); }}
      searchTerm={searchTerm}
      quotes={quotes}
      onOpenDirectLine={(q) => setQuoteDirectLine({ threadId: q.threadId, subtitle: q.serviceType })}
      onRespond={respondToQuote}
      onRefresh={() => setRefreshKey((k) => k + 1)}
    />,
  );
}
