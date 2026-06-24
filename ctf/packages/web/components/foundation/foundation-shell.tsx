"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Hammer, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { AppLoading } from "@/components/shared/app-loading";
import { useTheme } from "@/hooks/useTheme";
import { FONT, getFoundationTokens, type FoundationTab, type ProviderView, type QuoteView } from "./foundation-ui";
import { IconRail, FilterSidebar, RightRail } from "./foundation-rails";
import { BrowsePanel, QuotesPanel } from "./foundation-panels";
import { OfferSkillsPanel } from "./foundation-offer-skills";
import { ProviderProfile } from "./foundation-profile";
import { DirectLineFromQuote, DirectLineFromThread, type DirectLineCredentials } from "./foundation-direct-line";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";

const CSRF_HEADERS = { "Content-Type": "application/json", "x-ctf-csrf": "1" };

// Turn a failed Foundation API response into a clear member-facing message by reading the route's
// JSON `code`, instead of always showing a generic "could not open a connection". The most common
// case is requesting a quote from your own profile, which the server denies as a policy.
async function foundationErrorMessage(res: Response, fallback: string): Promise<string> {
  let code = "";
  let message = "";
  try {
    const body = (await res.json()) as { code?: string; message?: string };
    code = body.code ?? "";
    message = body.message ?? "";
  } catch {
    /* non-JSON body — fall back below */
  }
  switch (code) {
    case "FOUNDATION_POLICY_DENIED":
      return "You can't request a quote from your own profile.";
    case "FOUNDATION_PROVIDER_NOT_FOUND":
      return "This provider's profile could not be found.";
    case "FOUNDATION_RATE_LIMIT_EXCEEDED":
      return "You're sending requests too quickly — wait a moment and try again.";
    case "FOUNDATION_STREAM_UNAVAILABLE":
    case "FOUNDATION_PERSISTENCE_UNAVAILABLE":
      return "Connections are temporarily unavailable. Please try again shortly.";
    case "FOUNDATION_CSRF_DENIED":
      return "Your session needs a refresh — reload the page and try again.";
    default:
      return message || fallback;
  }
}

function Centered({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, color }}>
      {children}
    </div>
  );
}

export function FoundationShell({ isAdmin }: { isAdmin?: boolean } = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderView[]>([]);
  // The signed-in member's own id, returned by the search route, so the "Connect now" button is never
  // shown on the viewer's own provider card (you can't ring yourself).
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuoteView[]>([]);
  const [tab, setTab] = useState<FoundationTab>("browse");
  const [trade, setTrade] = useState("All Trades");
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
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);

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
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.set("q", searchTerm);
        if (skillId) params.set("skillId", skillId);
        const [searchRes] = await Promise.all([
          fetch(`/api/foundation/providers/search?${params.toString()}`),
          loadQuotes(),
        ]);
        if (!active) return;
        if (searchRes.ok) {
          const data = (await searchRes.json()) as { items?: ProviderView[]; viewerUserId?: string };
          setProviders(data.items ?? []);
          setViewerUserId(data.viewerUserId ?? null);
        }
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load Foundation.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [searchTerm, skillId, loadQuotes]);

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
      const threadData = (await threadRes.json()) as {
        thread?: { id?: string; streamChannelId?: string };
        streamApiKey?: string;
        streamUserId?: string;
        streamToken?: string;
      };
      const threadId = threadData.thread?.id;
      if (!threadId) throw new Error("Connection response was incomplete.");

      const serviceType = provider.headline?.trim() || "General trade service";
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

      // Take the member straight into the Direct Line using the credentials the thread POST already
      // returned. Fall back to the Quotes tab only if Stream credentials were not issued (e.g. Stream
      // is unconfigured), so the request is never lost.
      const channelId = threadData.thread?.streamChannelId;
      if (threadData.streamApiKey && threadData.streamUserId && threadData.streamToken && channelId) {
        setActiveDirectLine({
          credentials: {
            streamApiKey: threadData.streamApiKey,
            streamUserId: threadData.streamUserId,
            streamToken: threadData.streamToken,
            streamChannelId: channelId,
          },
          subtitle: provider.displayName,
        });
      } else {
        setTab("quotes");
      }
    } catch (e: unknown) {
      setQuoteError(e instanceof Error ? e.message : "Failed to request quote.");
    } finally {
      setSubmitting(false);
    }
  }, [loadQuotes]);

  if (loading) {
    return <AppLoading />;
  }

  if (error) {
    return <Centered color="#EF4444">{error}</Centered>;
  }

  // Direct Line opened straight after Request Quote (uses the credentials the POST returned).
  if (activeDirectLine) {
    return (
      <DirectLineFromQuote
        credentials={activeDirectLine.credentials}
        subtitle={activeDirectLine.subtitle}
        onBack={() => { setActiveDirectLine(null); setTab("quotes"); }}
      />
    );
  }

  // Direct Line re-opened from a Quotes row (fetches fresh credentials by thread id).
  if (quoteDirectLine) {
    return (
      <DirectLineFromThread
        threadId={quoteDirectLine.threadId}
        subtitle={quoteDirectLine.subtitle}
        onBack={() => setQuoteDirectLine(null)}
      />
    );
  }

  if (selected) {
    return (
      <ProviderProfile
        provider={selected}
        viewerUserId={viewerUserId}
        submitting={submitting}
        quoteError={quoteError}
        quoteSuccess={quoteSuccess}
        onBack={() => { setSelected(null); setQuoteError(null); setQuoteSuccess(false); }}
        onRequestQuote={() => { void requestQuote(selected); }}
      />
    );
  }

  const content = (
    <>
      {tab === "browse" && <BrowsePanel providers={providers} viewerUserId={viewerUserId} onSelect={setSelected} activeSkillId={skillId} activeSkillName={skillName} onSkillFilter={(id, name) => { setSkillId(id); setSkillName(name ?? null); }} />}
      {tab === "offer" && <OfferSkillsPanel />}
      {tab === "quotes" && (
        <QuotesPanel
          quotes={quotes}
          onBrowse={() => setTab("browse")}
          onOpenDirectLine={(q) => setQuoteDirectLine({ threadId: q.threadId, subtitle: q.serviceType })}
        />
      )}
    </>
  );

  if (isMobile) {
    const tabs: { key: FoundationTab; label: string }[] = [
      { key: "browse", label: "Browse" },
      { key: "offer", label: "Offer" },
      { key: "quotes", label: "Quotes" },
    ];
    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: FONT, color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <Hammer size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1 }}>Foundation</span>
            <PluginAdminButton href="/admin/foundation" isAdmin={isAdmin} accent={t.ACCENT} />
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: tab === key ? `${t.ACCENT}1A` : "transparent", border: `1px solid ${tab === key ? t.ACCENT + "40" : t.BORDER_STRONG}`, color: tab === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {tab === "browse" && (
            <div style={{ padding: "0 12px 10px" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.FAINT }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search trade providers…" style={{ width: "100%", padding: "8px 10px 8px 30px", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, fontSize: 13, color: t.SUBTLE, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
          )}
        </div>
        {content}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100dvh", overflow: "hidden", background: t.BG, fontFamily: FONT, color: t.TEXT, display: "flex" }}>
      <IconRail tab={tab} onTab={setTab} />
      <FilterSidebar query={query} onQuery={setQuery} trade={trade} onTrade={setTrade} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: t.HEADER, flexShrink: 0 }}>
          <Hammer size={18} style={{ color: t.ACCENT }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.TEXT }}>Foundation — Trade Services</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Community trade providers · Trauma-informed</div>
          </div>
          <PluginAdminButton href="/admin/foundation" isAdmin={isAdmin} accent={t.ACCENT} />
        </header>
        {content}
      </div>
      <RightRail providers={providers} quoteCount={quotes.length} onBrowse={() => setTab("browse")} onSelect={setSelected} />
    </div>
  );
}
